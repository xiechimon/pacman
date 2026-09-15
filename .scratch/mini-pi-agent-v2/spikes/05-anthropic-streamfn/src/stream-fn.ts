import Anthropic from '@anthropic-ai/sdk';
import type {
  AssistantMessage,
  ContentBlock,
  StopReason,
  ToolDef,
  StreamFn,
  StreamFnConfig,
  AgentEvent,
} from './types.js';

/**
 * Create a no-throw streaming function that wraps @anthropic-ai/sdk.
 *
 * Every code path returns an AssistantMessage — even network errors,
 * rate limits, aborts, and unexpected exceptions go through the
 * stopReason / errorMessage fields rather than throwing.
 */
export function createStreamFn(config: StreamFnConfig): StreamFn {
  const client = new Anthropic({ apiKey: config.apiKey });

  return async function stream(
    prompt: string,
    tools: ToolDef[],
    signal: AbortSignal,
    onEvent: (e: AgentEvent) => void,
  ): Promise<AssistantMessage> {
    // --- Accumulators -------------------------------------------------
    const contentBlocks: ContentBlock[] = [];
    let stopReason: StopReason = 'end';
    let inputTokens = 0;
    let outputTokens = 0;

    // Tool-use tracking: Anthropic sends deltas by index, not id.
    // content_block_start carries the id; content_block_delta carries the index.
    const toolUseById = new Map<string, ContentBlock & { type: 'tool_use' }>();
    const toolUseByIndex = new Map<number, string>(); // index -> id
    let rawJsonByIndex = new Map<number, string>();   // index -> accumulated partial JSON

    // --- Error normalisation helper -----------------------------------
    const normaliseError = (err: unknown, defaultMsg: string): string => {
      if (err instanceof Error) return err.message;
      if (typeof err === 'string') return err;
      return defaultMsg;
    };

    // --- Stop reason mapper -------------------------------------------
    const mapStopReason = (raw: string | null): StopReason => {
      switch (raw) {
        case 'end_turn':                      return 'end';
        case 'max_tokens':
        case 'model_context_window_exceeded': return 'length';
        case 'tool_use':                      return 'toolUse';
        case 'stop_sequence':                 return 'stopSequence';
        case 'refusal':                       return 'refusal';
        case 'pause_turn':
          // pause_turn: model paused mid-turn (called a tool but we
          // haven't seen the tool_use block in this turn — edge case,
          // treat as toolUse since the intent is to use a tool).
          return 'toolUse';
        default:
          return 'end';
      }
    };

    // --- Main streaming loop ------------------------------------------
    try {
      // Check abort before making the request.
      if (signal.aborted) {
        return {
          role: 'assistant',
          content: [],
          stopReason: 'aborted',
          errorMessage: 'Request aborted before start',
          usage: { inputTokens: 0, outputTokens: 0 },
        };
      }

      const stream = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens ?? 4096,
        system: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: prompt }],
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Tool.InputSchema,
        })),
        stream: true,
      });

      for await (const event of stream) {
        // Abort check inside the loop — the caller may abort mid-stream.
        if (signal.aborted) {
          // Suppress the abort from surfacing as a throw from the SSE
          // parser — we've already handled it.
          try { stream.controller.abort(); } catch { /* best-effort */ }
          return {
            role: 'assistant',
            content: contentBlocks,
            stopReason: 'aborted',
            errorMessage: 'Stream aborted by caller',
            usage: { inputTokens, outputTokens },
          };
        }

        switch (event.type) {
          // --- Text deltas -------------------------------------------------
          case 'content_block_delta': {
            const delta = event.delta;
            if (delta.type === 'text_delta') {
              // Find or create the text block. The SDK guarantees text
              // blocks are sequential and contiguous — we can append to
              // the last text block in our array.
              const last = contentBlocks[contentBlocks.length - 1];
              if (last && last.type === 'text') {
                last.text += delta.text;
              } else {
                contentBlocks.push({ type: 'text', text: delta.text });
              }
              onEvent({ type: 'text_delta', text: delta.text });
            } else if (delta.type === 'input_json_delta') {
              // Accumulate tool-use JSON deltas.
              const idx = event.index;
              const existing = rawJsonByIndex.get(idx) ?? '';
              rawJsonByIndex.set(idx, existing + delta.partial_json);

              const toolId = toolUseByIndex.get(idx);
              if (toolId) {
                onEvent({ type: 'tool_use_delta', id: toolId, inputJsonDelta: delta.partial_json });
              }
            }
            break;
          }

          // --- Block starts -------------------------------------------------
          case 'content_block_start': {
            const block = event.content_block;
            if (block.type === 'text') {
              // Text block start: the next content_block_delta will add text.
              // We create an empty text block to receive deltas.
              contentBlocks.push({ type: 'text', text: '' });
            } else if (block.type === 'tool_use') {
              // Tool-use block start: record id, name, and index mapping.
              const tb: ContentBlock & { type: 'tool_use' } = {
                type: 'tool_use',
                id: block.id,
                name: block.name,
                input: {},
              };
              toolUseById.set(block.id, tb);
              toolUseByIndex.set(event.index, block.id);
              rawJsonByIndex.set(event.index, '');
              contentBlocks.push(tb);
              onEvent({ type: 'tool_use_start', id: block.id, name: block.name });
            }
            break;
          }

          // --- Block stops --------------------------------------------------
          case 'content_block_stop': {
            const idx = event.index;
            const toolId = toolUseByIndex.get(idx);
            if (toolId) {
              // Finalise the accumulated JSON.
              const raw = rawJsonByIndex.get(idx) ?? '{}';
              let parsed: Record<string, unknown> = {};
              try { parsed = JSON.parse(raw); } catch { /* partial — keep {} */ }
              const tb = toolUseById.get(toolId);
              if (tb) {
                tb.input = parsed;
                onEvent({ type: 'tool_use_end', id: toolId, name: tb.name, input: parsed });
              }
              rawJsonByIndex.delete(idx);
            }
            break;
          }

          // --- Message lifecycle --------------------------------------------
          case 'message_start': {
            // The message_start event carries input token count from the
            // usage object on the message field.
            const msg = event.message;
            if (msg.usage) {
              inputTokens = msg.usage.input_tokens;
              // output_tokens starts at 0 and gets updated in message_delta.
            }
            break;
          }

          case 'message_delta': {
            // Cumulative output tokens arrive here.
            outputTokens = event.usage.output_tokens;
            // The final stop_reason arrives on the delta, not message_stop.
            stopReason = mapStopReason(event.delta.stop_reason);
            break;
          }

          case 'message_stop':
            // message_stop signals end of the message. We already have
            // stopReason from message_delta, tokens are finalised.
            break;

          default:
            // Ping events (SSE keep-alive) are no-ops; anything else is unexpected.
            if ((event as any).type !== 'ping') {
              onEvent({ type: 'error', message: `Unknown stream event: ${(event as any).type}` });
            }
            break;
        }
      }
    } catch (err) {
      // --- Error-to-event translation ----------------------------------
      // Check if the error was caused by an abort (the SDK wraps
      // AbortError in APIUserAbortError).
      const msg = normaliseError(err, 'Unknown streaming error');

      if (signal.aborted || msg.includes('abort') || msg.includes('AbortError') || msg.includes('APIUserAbortError')) {
        stopReason = 'aborted';
      } else if (msg.includes('rate') || msg.includes('Rate') || msg.includes('429') || msg.includes('RateLimitError') || msg.includes('overloaded_error')) {
        stopReason = 'error';
      } else {
        stopReason = 'error';
      }

      onEvent({ type: 'error', message: msg });

      return {
        role: 'assistant',
        content: contentBlocks,
        stopReason,
        errorMessage: msg,
        usage: { inputTokens, outputTokens },
      };
    }

    // --- Normal return -------------------------------------------------
    return {
      role: 'assistant',
      content: contentBlocks,
      stopReason,
      usage: { inputTokens, outputTokens },
    };
  };
}