// Fixture record contract = 02-架构平价 §6.2 + §4.1 todo field table.
// Field set copied from the r3 §3.0 observed wire shape:
// phaseAt/seqNum/orderIndex/tagIds/spec/assignment/agent/latestBuildId/
// lastRunAt/hasChanges/hasPlan/buildHistory/sourceTodo/v — plus one [推断]
// display-only extension (awaitingReply, see the field) carried for the
// observed waiting-on-user board placement.
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
  /** True when the latest run stopped to ask the user something (r5b §3.15
   *  #1: phase review, card sits in 执行中 with a 回复 button). [推断] wire
   *  field — not in the r3 §3.0 snapshot, needed to reproduce the observed
   *  board placement and card action for waiting-on-user todos. */
  awaitingReply?: boolean;
}

/** One deterministic content set behind a scenario id. `now` is the frozen
 *  reference instant for relative labels (capture time of the r7 shot), so
 *  parity output never drifts with wall-clock time. */
export interface FixtureSet {
  todos: TodoRecord[];
  now: number;
}
