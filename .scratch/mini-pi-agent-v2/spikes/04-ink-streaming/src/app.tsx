import React, { useState, useRef, useCallback } from "react";
import { render, Box, Text } from "ink";
import { StreamingOutput } from "./components/StreamingOutput.js";
import { InputArea } from "./components/InputArea.js";

/**
 * THROWAWAY SPIKE — Ink streaming TUI for mini-pi v2 feasibility.
 *
 * Question: Can Ink 4.x + React 18 handle 50-100 token/sec streaming
 *           without visible jank or input lag?
 *
 * Run: `pnpm start` from the spike directory.
 */

function App() {
  const [streaming, setStreaming] = useState(true);
  const [messages, setMessages] = useState<string[]>([]);
  const streamKey = useRef(0);

  const handleDone = useCallback(() => {
    setStreaming(false);
  }, []);

  const handleRestart = useCallback(() => {
    streamKey.current += 1;
    setStreaming(true);
  }, []);

  const handleSubmit = useCallback(
    (value: string) => {
      setMessages((m) => [...m, value]);
      if (!streaming) {
        // Re-run the stream
        streamKey.current += 1;
        setStreaming(true);
      }
    },
    [streaming],
  );

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="magenta">
          mini-pi v2 · Ink Streaming Spike
        </Text>
        <Text dimColor>
          Prototype — does Ink reconcile fast enough for agent output streaming?
        </Text>
        <Text dimColor>
          Press Ctrl+C to exit. Type a message and Enter to re-trigger the stream.
        </Text>
      </Box>

      {/* Stats bar */}
      <Box marginBottom={1}>
        <Text dimColor>
          Target: ~33 chars/s (~10 tokens/s at 3 chars/token) | Delay: 30ms/char
        </Text>
      </Box>

      {/* Separator */}
      <Box marginBottom={1}>
        <Text dimColor>{"─".repeat(60)}</Text>
      </Box>

      {/* Streaming content area */}
      {streaming ? (
        <StreamingOutput key={streamKey.current} speed={30} onDone={handleDone} />
      ) : (
        <Box flexDirection="column">
          <Text color="green">Stream finished. Type a message to replay.</Text>
          {messages.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold>Messages:</Text>
              {messages.map((m, i) => (
                <Text key={i} dimColor>
                  {"  "}
                  {m}
                </Text>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Separator */}
      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>{"─".repeat(60)}</Text>
      </Box>

      {/* Input area */}
      <InputArea
        onSubmit={handleSubmit}
        disabled={streaming}
        placeholder={streaming ? "Waiting for stream..." : "Type a message..."}
      />

      {/* Restart hint */}
      {!streaming && (
        <Box marginTop={1}>
          <Text dimColor>Press Enter with empty input to replay the stream.</Text>
        </Box>
      )}
    </Box>
  );
}

// --- Entry point ---
const { waitUntilExit } = render(<App />);
// Let the process exit when the renderer unmounts
waitUntilExit().then(() => {
  // Clean exit
});