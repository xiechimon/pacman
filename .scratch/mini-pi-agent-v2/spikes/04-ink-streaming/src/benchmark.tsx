/**
 * Headless benchmark: measures Ink rendering throughput at various token rates.
 *
 * Renders a StreamingOutput component to a fake stdout and feeds text at
 * controlled speeds. Measures: events/sec, avg render latency, max latency.
 *
 * This answers question #5: "Does Ink handle 50-100 token/sec without jank?"
 * (at ~4 chars/token, that's 200-400 chars/sec = 2.5-5ms per char).
 */
import { render, Box, Text } from "ink";
import React, { useState, useEffect, useRef } from "react";
import { Writable } from "stream";

// ---- Fake TTY stream ----
class FakeTTY extends Writable {
  public frameCount = 0;
  public lastWrite = 0;
  public latencies: number[] = [];
  public bytes = 0;
  isTTY = true;
  rows = 40;
  columns = 120;

  _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    const now = Date.now();
    if (this.lastWrite > 0) {
      this.latencies.push(now - this.lastWrite);
    }
    this.lastWrite = now;
    this.frameCount++;
    this.bytes += Buffer.byteLength(chunk);
    callback();
  }
}

// ---- Benchmark component: appends characters as fast as React can handle ----
function BenchmarkApp({
  onReady,
  charDelay,
  totalChars,
}: {
  onReady: () => void;
  charDelay: number;
  totalChars: number;
}) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let i = 0;

    const stream = async () => {
      const lorem =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
        "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " +
        "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris. ";

      while (i < totalChars && !cancelled) {
        const ch = lorem[i % lorem.length];
        setText((prev) => prev + ch);
        i++;
        await new Promise((r) => setTimeout(r, charDelay));
      }
      if (!cancelled) {
        setDone(true);
        // Signal the outer runner one tick after the last render
        setTimeout(onReady, 100);
      }
    };

    stream().catch((e) => {
      if (!cancelled) setError(String(e));
    });
    return () => {
      cancelled = true;
    };
  }, [charDelay, totalChars, onReady]);

  if (error) return <Text>Error: {error}</Text>;
  if (done) return <Text>Done: {text.length} chars</Text>;
  return <Text>{text}</Text>;
}

// ---- Runner ----
async function runBenchmark(
  charDelayMs: number,
  totalChars: number,
  label: string,
) {
  console.log(`\n=== ${label} ===`);
  console.log(
    `  Config: ${totalChars} chars, ${charDelayMs}ms delay = ~${(1000 / charDelayMs).toFixed(0)} chars/sec`,
  );

  const stdout = new FakeTTY();
  let resolveReady: () => void;
  const ready = new Promise<void>((r) => {
    resolveReady = r;
  });

  const start = Date.now();
  const instance = render(
    <BenchmarkApp
      onReady={resolveReady!}
      charDelay={charDelayMs}
      totalChars={totalChars}
    />,
    { stdout: stdout as unknown as NodeJS.WriteStream, stdin: process.stdin, stderr: process.stderr, exitOnCtrlC: false },
  );

  await ready;
  const wallClock = Date.now() - start;

  // Give a tick for last render
  await new Promise((r) => setImmediate(r));
  instance.unmount();

  const avgLatency =
    stdout.latencies.length > 0
      ? stdout.latencies.reduce((a, b) => a + b, 0) / stdout.latencies.length
      : 0;
  const maxLatency =
    stdout.latencies.length > 0 ? Math.max(...stdout.latencies) : 0;
  const fps = stdout.frameCount / (wallClock / 1000);

  console.log(`  Wall clock:   ${wallClock}ms`);
  console.log(`  Renders:      ${stdout.frameCount} frames`);
  console.log(`  Bytes out:    ${stdout.bytes}`);
  console.log(`  Avg latency:  ${avgLatency.toFixed(1)}ms between renders`);
  console.log(`  Max latency:  ${maxLatency.toFixed(1)}ms (jank indicator)`);
  console.log(`  Effective FPS: ${fps.toFixed(1)}`);

  const janky = maxLatency > charDelayMs * 3;
  console.log(
    `  Verdict:       ${janky ? "JANK DETECTED" : "Smooth"} (max latency ${maxLatency > charDelayMs * 3 ? ">" : "<="} 3x char delay)`,
  );

  return { wallClock, frames: stdout.frameCount, avgLatency, maxLatency, fps };
}

// ---- Main ----
async function main() {
  console.log("Ink Streaming Render Benchmark");
  console.log("==============================\n");

  // Test 1: ~33 chars/sec (our default sim speed)
  const r1 = await runBenchmark(30, 100, "Test 1: 33 chars/sec (default sim)");

  // Test 2: ~100 chars/sec (~25 tokens/sec)
  const r2 = await runBenchmark(10, 200, "Test 2: 100 chars/sec (~25 tok/s)");

  // Test 3: ~250 chars/sec (~63 tokens/sec, within target range)
  const r3 = await runBenchmark(4, 300, "Test 3: 250 chars/sec (~63 tok/s)");

  // Test 4: ~400 chars/sec (~100 tokens/sec, top of target range)
  const r4 = await runBenchmark(2.5, 300, "Test 4: 400 chars/sec (~100 tok/s)");

  // Test 5: ~1000 chars/sec (stress test)
  const r5 = await runBenchmark(1, 500, "Test 5: 1000 chars/sec (stress)");

  console.log("\n==============================");
  console.log("Summary:");
  console.log("  Target: 50-100 tokens/sec (~200-400 chars/sec)");
  console.log(`  33 chars/s:  ${r1.maxLatency.toFixed(1)}ms max latency — ${r1.maxLatency > 90 ? "JANK" : "smooth"}`);
  console.log(`  100 chars/s: ${r2.maxLatency.toFixed(1)}ms max latency — ${r2.maxLatency > 30 ? "JANK" : "smooth"}`);
  console.log(`  250 chars/s: ${r3.maxLatency.toFixed(1)}ms max latency — ${r3.maxLatency > 12 ? "JANK" : "smooth"}`);
  console.log(`  400 chars/s: ${r4.maxLatency.toFixed(1)}ms max latency — ${r4.maxLatency > 7.5 ? "JANK" : "smooth"}`);
  console.log(`  1000 chars/s: ${r5.maxLatency.toFixed(1)}ms max latency — ${r5.maxLatency > 3 ? "JANK" : "smooth"}`);
  console.log(`\n  Key: max latency > 3x char delay = visible jank`);

  // Clean exit
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});