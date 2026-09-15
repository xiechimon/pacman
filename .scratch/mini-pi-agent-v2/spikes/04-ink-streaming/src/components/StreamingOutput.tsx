import React, { useEffect, useState, useRef, useCallback } from "react";
import { Text, Box } from "ink";
import { type StreamEvent, streamScenario } from "../simulate.js";

interface StreamingOutputProps {
  /** Milliseconds between characters (default 30) */
  speed?: number;
  /** Called when the full stream finishes */
  onDone?: () => void;
}

/**
 * Renders streaming text character-by-character, tool calls, and tool results.
 * Uses useState batching — each character triggers a React re-render.
 * This is the key stress-test: can Ink's reconciler keep up?
 */
export function StreamingOutput({ speed = 30, onDone }: StreamingOutputProps) {
  // Accumulated text lines that have been fully rendered
  const [lines, setLines] = useState<string[]>([]);
  // Currently streaming line (not yet committed to lines[])
  const [currentLine, setCurrentLine] = useState("");
  // Active tool calls (id -> {name, input})
  const [activeTools, setActiveTools] = useState<
    Map<string, { name: string; input: Record<string, unknown> }>
  >(new Map());
  // Completed tool results
  const [toolResults, setToolResults] = useState<
    { id: string; name: string; result: string }[]
  >([]);
  // Is streaming done?
  const [done, setDone] = useState(false);
  // Performance counters
  const [eventCount, setEventCount] = useState(0);
  const startTime = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  // Timer to update elapsed time display
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime.current);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleEvent = useCallback(
    (event: StreamEvent) => {
      setEventCount((c) => c + 1);
      switch (event.type) {
        case "text": {
          const ch = event.content;
          setCurrentLine((prev) => {
            if (ch === "\n") {
              setLines((l) => [...l, prev]);
              return "";
            }
            return prev + ch;
          });
          break;
        }
        case "tool_call_start": {
          // Flush current line before showing tool call
          setCurrentLine((prev) => {
            if (prev.length > 0) {
              setLines((l) => [...l, prev]);
            }
            return "";
          });
          setActiveTools((prev) => {
            const next = new Map(prev);
            next.set(event.id, { name: event.name, input: event.input });
            return next;
          });
          break;
        }
        case "tool_call_end": {
          setActiveTools((prev) => {
            const next = new Map(prev);
            next.delete(event.id);
            return next;
          });
          setToolResults((prev) => [
            ...prev,
            { id: event.id, name: "tool", result: event.result },
          ]);
          break;
        }
        case "done":
          // Flush any remaining text
          setCurrentLine((prev) => {
            if (prev.length > 0) {
              setLines((l) => [...l, prev]);
            }
            return "";
          });
          setDone(true);
          onDone?.();
          break;
      }
    },
    [onDone],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for await (const event of streamScenario(speed)) {
        if (cancelled) break;
        handleEvent(event);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [speed, handleEvent]);

  const allToolResults = toolResults;

  return (
    <Box flexDirection="column">
      {/* Rendered lines */}
      {lines.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}

      {/* Currently streaming line */}
      {currentLine.length > 0 && <Text>{currentLine}</Text>}

      {/* Active tool calls (spinner) */}
      {activeTools.size > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {Array.from(activeTools.entries()).map(([id, tool]) => (
            <Box key={id}>
              <Text color="yellow" dimColor>
                {"◇ "}
              </Text>
              <Text color="yellow">Running {tool.name}...</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Tool results */}
      {allToolResults.map((tr, i) => (
        <Box key={i} flexDirection="column" marginTop={1}>
          <Text color="cyan" dimColor>
            {"▼ "}Tool result:
          </Text>
          {tr.result.split("\n").map((line, j) => (
            <Text key={j} color="cyan" dimColor>
              {"  "}
              {line}
            </Text>
          ))}
        </Box>
      ))}

      {/* Done and perf stats */}
      {done && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="green">{"\n--- Stream complete ---"}</Text>
          <Text dimColor>
            Events processed: {eventCount} | Elapsed: {(elapsed / 1000).toFixed(1)}s
            {" | "}
            Avg: {elapsed > 0 ? (eventCount / (elapsed / 1000)).toFixed(0) : 0} events/s
          </Text>
        </Box>
      )}
    </Box>
  );
}