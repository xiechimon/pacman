// --- Mini-Pi v2 agent event types ---

/** Stop reasons that our wrapper normalises from Anthropic's raw values. */
export type StopReason =
  | 'end'           // Anthropic end_turn
  | 'length'        // Anthropic max_tokens / model_context_window_exceeded
  | 'toolUse'       // Anthropic tool_use
  | 'stopSequence'  // Anthropic stop_sequence
  | 'refusal'       // Anthropic refusal
  | 'error'         // any exception / API error caught by the wrapper
  | 'aborted';      // AbortSignal fired

/** A single content block inside the assistant's message. */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

/** The final shape returned by the stream function — never throws. */
export interface AssistantMessage {
  role: 'assistant';
  content: ContentBlock[];
  stopReason: StopReason;
  /** Human-readable detail when stopReason is 'error'. */
  errorMessage?: string;
  usage: { inputTokens: number; outputTokens: number };
}

/** Events emitted via the onEvent callback during streaming. */
export type AgentEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_delta'; id: string; inputJsonDelta: string }
  | { type: 'tool_use_end'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'error'; message: string };

/** Tool definition the caller provides. Mirrors the Anthropic shape. */
export interface ToolDef {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

/** Signature of the stream function factory. */
export interface StreamFnConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
}

export type StreamFn = (
  prompt: string,
  tools: ToolDef[],
  signal: AbortSignal,
  onEvent: (e: AgentEvent) => void,
) => Promise<AssistantMessage>;