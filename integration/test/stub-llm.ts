// stub LLM = OpenAI Chat Completions 兼容 SSE 端点（pi-ai `openai-completions`
// api 消费面）。集成 demo/T2 用它替代真 provider——「无密钥网关可留空」
// （r3 §2 表单语义）使凭证面不参与骨架验证。

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface StubResponse {
  content?: string;
  /** 响应前延迟（崩溃窗口用）。 */
  delayMs?: number;
  usage?: { prompt: number; completion: number; cached?: number };
}

export interface StubRequest {
  messages: { role: string; content?: unknown }[];
  model?: string;
  stream?: boolean;
}

export interface StubLlm {
  url: string;
  requests: StubRequest[];
  close(): Promise<void>;
}

const DEFAULT_USAGE = { prompt: 12, completion: 980, cached: 100 };

function chunk(payload: object): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function startStubLlm(
  responses: StubResponse[],
  opts: { onConsumed?: () => void } = {},
): Promise<StubLlm> {
  const requests: StubRequest[] = [];
  let next = 0;
  const server: Server = createServer((req, res) => {
    if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    req.on('data', (d) => {
      body += d;
    });
    req.on('end', () => {
      requests.push(JSON.parse(body) as StubRequest);
      const rsp = responses[Math.min(next, responses.length - 1)] ?? { content: 'ok' };
      next += 1;
      const usage = rsp.usage ?? DEFAULT_USAGE;
      const send = () => {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
        });
        const base = {
          id: 'chatcmpl-stub',
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'stub-model',
        };
        res.write(
          chunk({
            ...base,
            choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
          }),
        );
        // 内容按词切块（text_delta 多帧，transcript 流形更接近真 provider）。
        for (const word of (rsp.content ?? 'ok').split(/(?<=。|\.|\s)/u)) {
          if (word === '') continue;
          res.write(chunk({ ...base, choices: [{ index: 0, delta: { content: word } }] }));
        }
        res.write(chunk({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }));
        res.write(
          chunk({
            ...base,
            choices: [],
            usage: {
              prompt_tokens: usage.prompt,
              completion_tokens: usage.completion,
              total_tokens: usage.prompt + usage.completion,
              prompt_tokens_details: { cached_tokens: usage.cached ?? 0 },
            },
          }),
        );
        res.write('data: [DONE]\n\n');
        res.end();
        opts.onConsumed?.();
      };
      if (rsp.delayMs) setTimeout(send, rsp.delayMs);
      else send();
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
