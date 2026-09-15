import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface InputAreaProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Bottom input area — a simple TextInput with a prompt marker.
 * Placeholder for the real mini-pi v2 input editor.
 */
export function InputArea({
  onSubmit,
  placeholder = "Type a message...",
  disabled = false,
}: InputAreaProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (val: string) => {
    if (disabled) return;
    onSubmit(val);
    setValue("");
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {disabled ? (
        <Box>
          <Text dimColor>{"⏳"} Waiting for response...</Text>
        </Box>
      ) : (
        <Box>
          <Text color="green">{"> "}</Text>
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder={placeholder}
          />
        </Box>
      )}
    </Box>
  );
}