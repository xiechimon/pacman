/**
 * Smoke test: real API call to verify the streaming pipeline.
 *
 * Usage:  ANTHROPIC_API_KEY=sk-... pnpm smoke
 *
 * Sends a simple "say hello" prompt (no tools), streams the response,
 * and prints the accumulated AssistantMessage.
 */

import { createStreamFn } from './stream-fn.js';
import type { AgentEvent } from './types.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Set ANTHROPIC_API_KEY to run the smoke test.');
  process.exit(1);
}

const stream = createStreamFn({
  apiKey,
  model: process.env.MODEL ?? 'claude-sonnet-4-20250514',
  maxTokens: 256,
});

console.log('>>> Streaming "say hello" ...\n');

const events: AgentEvent[] = [];
const abort = new AbortController();

const result = await stream(
  'Say hello in exactly one sentence.',
  [],
  abort.signal,
  (e) => {
    events.push(e);
    if (e.type === 'text_delta') process.stdout.write(e.text);
  },
);

console.log('\n\n>>> Result:');
console.log(JSON.stringify(result, null, 2));
console.log(`\n>>> Events emitted: ${events.length}`);
console.log(`    Text deltas: ${events.filter((e) => e.type === 'text_delta').length}`);
console.log(`    Errors:      ${events.filter((e) => e.type === 'error').length}`);