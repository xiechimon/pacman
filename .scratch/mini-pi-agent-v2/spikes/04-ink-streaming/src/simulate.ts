/**
 * Fake streaming data generator for the Ink TUI spike.
 * Simulates a multi-part agent response: text streaming, tool calls, results.
 */

export interface TextChunk {
  type: "text";
  content: string;
}

export interface ToolCallStart {
  type: "tool_call_start";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolCallEnd {
  type: "tool_call_end";
  id: string;
  result: string;
}

export interface Done {
  type: "done";
}

export type StreamEvent = TextChunk | ToolCallStart | ToolCallEnd | Done;

/** The pre-canned scenario we stream out character by character. */
const SCENARIO: StreamEvent[] = [
  // --- paragraph 1: streaming markdown text ---
  {
    type: "text",
    content:
      "# Analysis Results\n\n" +
      "Based on the codebase review, here are the key findings:\n\n" +
      "The **session manager** handles lifecycle events through a `SessionTree` data " +
      "structure. Each node represents a conversation turn, with parent-child links " +
      "that model branching and continuations. The tree supports `fork()`, `merge()`, " +
      "and `prune()` operations — all of which are O(log n) thanks to an internal " +
      "skip-list index.\n\n" +
      "## Performance Characteristics\n\n" +
      "- Average branching factor: **2.3** across 10k sampled sessions\n" +
      "- Tree depth rarely exceeds **12** in production workloads\n" +
      "- Memory overhead per node: **~640 bytes** (including GC roots)\n",
  },
  // --- tool call 1 ---
  {
    type: "tool_call_start",
    id: "call_01",
    name: "read_file",
    input: { path: "src/session/SessionTree.ts", startLine: 1, endLine: 80 },
  },
  {
    type: "tool_call_end",
    id: "call_01",
    result:
      "export class SessionTree<T> {\n" +
      "  private root: TreeNode<T>;\n" +
      "  private index: SkipList<TreeNode<T>>;\n" +
      '  private _size: number = 0;\n' +
      "  ...\n" +
      "  fork(parentId: string): TreeNode<T> { ... }\n" +
      "  merge(childId: string, targetId: string): void { ... }\n" +
      "}",
  },
  // --- paragraph 2: more streaming markdown ---
  {
    type: "text",
    content:
      "\n\nThe `SkipList` index is the key innovation. Unlike a flat `Map<string, TreeNode>` " +
      "which would make `prune()` O(n) (you'd need to walk every descendant), the skip-list " +
      "maintains level pointers that let us jump directly to subtrees. This keeps all three " +
      "operations logarithmic.\n\n" +
      "## Recommendation\n\n" +
      "The session tree implementation is solid. However, the `fork()` method currently " +
      "does a **deep copy** of the node's metadata — this is unnecessary since metadata " +
      "is immutable in practice. Switching to a shallow copy would reduce fork latency " +
      "by ~40% in micro-benchmarks.\n",
  },
  // --- tool call 2 ---
  {
    type: "tool_call_start",
    id: "call_02",
    name: "grep",
    input: { pattern: "deepCopy|cloneDeep|structuredClone", path: "src/session/" },
  },
  {
    type: "tool_call_end",
    id: "call_02",
    result:
      "src/session/SessionTree.ts:142:  const cloned = structuredClone(node.metadata);\n" +
      "src/session/SessionTree.ts:289:  const cloned = structuredClone(node.metadata);\n" +
      "src/session/MetadataStore.ts:56:  private deepCopy(data: Metadata): Metadata { ... }\n" +
      "\n3 occurrences across 2 files.",
  },
  // --- final paragraph ---
  {
    type: "text",
    content:
      "\nThe grep confirms two `structuredClone` calls in `SessionTree.ts` and one helper in " +
      "`MetadataStore.ts`. All three are on the hot path — `fork()` and `merge()` call them " +
      "unconditionally. Since metadata fields are all primitive strings and numbers, a simple " +
      "spread (`{ ...node.metadata }`) would be equivalent and ~100x faster than structuredClone.\n",
  },
  { type: "done" },
];

/**
 * Async generator that yields the scenario character-by-character for text chunks,
 * and yields tool_call events as atomic items.
 *
 * @param charDelayMs  Delay between each character (simulates token streaming ~30ms)
 * @param toolDelayMs  Extra pause before/after tool calls for realism
 */
export async function* streamScenario(
  charDelayMs = 30,
  toolDelayMs = 400,
): AsyncGenerator<StreamEvent> {
  for (const event of SCENARIO) {
    if (event.type === "text") {
      // Stream text character by character
      for (const ch of event.content) {
        await sleep(charDelayMs);
        yield { type: "text", content: ch };
      }
    } else if (event.type === "tool_call_start") {
      await sleep(toolDelayMs);
      yield event;
      await sleep(toolDelayMs);
    } else if (event.type === "tool_call_end") {
      await sleep(toolDelayMs);
      yield event;
    } else if (event.type === "done") {
      yield event;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}