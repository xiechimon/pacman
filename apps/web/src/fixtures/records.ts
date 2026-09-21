// Fixture record contract = 02-架构平价 §6.2 + §4.1 todo field table.
// Field set copied from the r3 §3.0 observed wire shape:
// phaseAt/seqNum/orderIndex/tagIds/spec/assignment/agent/latestBuildId/
// lastRunAt/hasChanges/hasPlan/buildHistory/sourceTodo/v.
// Timestamps are epoch milliseconds (02 §6.2 schedule record precedent).

export const PHASE_VALUES = [
  'todo',
  'queued',
  'planning',
  'confirm',
  'building',
  'review',
  'done',
  'failed',
  'closed',
] as const;

export type Phase = (typeof PHASE_VALUES)[number];

/** Agent reference embedded in a todo record (02 §6.2 agent shape subset). */
export interface AgentRef {
  id: string;
  displayName: string;
}

/** Agent assignment on a todo (r3 §3.0 `assignment` field). */
export interface AssignmentRecord {
  agentId: string;
}

/** Build history entry (buildId ≡ conversationId, CONTEXT.md). */
export interface BuildRef {
  buildId: string;
  createdAt: number;
}

export interface TodoRecord {
  id: string;
  teamId: string;
  projectId: string;
  title: string;
  spec: string;
  phase: Phase;
  phaseAt: number;
  seqNum: number;
  orderIndex: number;
  tagIds: string[];
  assignment: AssignmentRecord | null;
  agent: AgentRef | null;
  latestBuildId: string | null;
  lastRunAt: number | null;
  hasChanges: boolean;
  hasPlan: boolean;
  buildHistory: BuildRef[];
  sourceTodo: string | null;
  /** Record version, r3 §3.0 wire field replicated verbatim (value observed 2–4). */
  v: number;
}

/** One deterministic content set behind a scenario id. */
export interface FixtureSet {
  todos: TodoRecord[];
}
