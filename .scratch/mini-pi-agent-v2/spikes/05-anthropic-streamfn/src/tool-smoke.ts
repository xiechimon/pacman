/**
 * Tool-use smoke test: verifies the tool_use streaming path.
 * Usage:  ANTHROPIC_API_KEY=sk-... npx tsx src/tool-smoke.ts
 */
import { createStreamFn } from './stream-fn.js';
import type { AgentEvent } from './types.js';

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Set ANTHROPIC_API_KEY to run.');
    process.exit(1);
  }

  const stream = createStreamFn({
    apiKey,
    model: process.env.MODEL ?? 'claude-sonnet-4-20250514',
    maxTokens: 512,
  });

  const events: AgentEvent[] = [];
  const result = await stream(
    'What is the weather in San Francisco? Use the get_weather tool.',
    [{
      name: 'get_weather',
      description: 'Get weather for a city',
      input_schema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
    }],
    new AbortController().signal,
    (e) => { events.push(e); },
  );

  console.log('\n>>> Result:');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\n>>> Events emitted: ${events.length}`);
  for (const e of events) {
    console.log(`    ${e.type}: ${JSON.stringify(e).slice(0, 120)}`);
  }
}

main().catch(console.error);