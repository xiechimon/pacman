// phase 九值权威（02 §4.1，锁定）——复刻全线的唯一 phase 词表源。
// 内部名取 docs 序；`exec` 为 r3 早期猜测，已作废正名 `building`（02 §4.1）。
// 本模块刻意零依赖（不 import zod）：web 端可直接消费而不拖入 schema 运行时。
// zod schema 版见 records/common.ts（phaseSchema，由本表派生）。

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

/** 语义 = docs 原文（02 §4.1 表）。 */
export const PHASE_SEMANTICS: Readonly<Record<Phase, string>> = {
  todo: '已建档未开始',
  queued: '已启动，等空闲机器',
  planning: '读仓库写计划',
  confirm: '计划就绪等你',
  building: '在改',
  review: '改动就绪等你（`待验收`≡`审核` 同 phase，CONTEXT.md 裁决）',
  done: '已接受，若选了则已合并',
  failed: 'run 停在错误上',
  closed: '未完成即搁置',
};

/** 工作台 4 列（#351；前身 = r2 §4.1 的 6 列折叠）——列只是 phase 的折叠
 *  视图，非独立实体（CONTEXT.md）。 */
export const BOARD_COLUMNS = ['待开始', '执行中', '待处理', '已完成'] as const;

export type BoardColumn = (typeof BOARD_COLUMNS)[number];

/**
 * 列映射单键 phase（#351：原 phase × hasChanges 双键折叠随 6→4 列收敛退役）：
 * gate 三态（confirm / review / failed）同入 `待处理`——方案确认、变更验收、
 * 失败重试都是等用户处理的事；review+awaitingReply 与 failed 的钉顶是渲染
 * 行为（web columns.ts sortColumnTodos），列归属同 `待处理`。
 * `queued→待开始` 折叠与 `closed` 不占列为 [推断]（02 §4.1，改判触发 = UI 实验）。
 * `done` 列语义 =「已完成（近 7 天）」（changelog "Done (last 7 days)"）。
 */
export function boardColumnFor(phase: Phase): BoardColumn | null {
  switch (phase) {
    case 'todo':
    case 'queued':
      return '待开始';
    case 'planning':
    case 'building':
      return '执行中';
    case 'confirm':
    case 'review':
    case 'failed':
      return '待处理';
    case 'done':
      return '已完成';
    case 'closed':
      return null; // 不占列 [推断]（右键 Close 菜单项实测 r1 §443）
  }
}

/** 手动改相面落点集（#160 看板拖拽）= 持落点列 dropPhase 正名（web columns.ts
 *  COLUMNS[].dropPhase 的同表镜像，columns.test.ts 有自动对拍钉单源）。
 *  拖拽只产生「源相占列 → 目标列」：`closed` 不占列故不可作拖拽源或落点；
 *  #351：`待处理` 不作落点（gate/failed 是系统态，手动拖入无语义）。
 *  官方 PATCH wire 未抓（r3 §3.10 合成拖拽未复现），手动面语义为复刻裁定
 *  [设计]；系统流仍走 PHASE_TRANSITIONS 漏斗（server services/phase.ts）。 */
export const BOARD_DROP_PHASES: readonly Phase[] = ['todo', 'building', 'done'];
