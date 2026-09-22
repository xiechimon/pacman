// Phase → UI copy matrix (issue #56): the single table both the detail
// header and the board card action read (one source for 开始/确认/完成/
// 重开). Two word lists again (CONTEXT.md
// ruling): board column names vs the detail chip words — `待验收`≡`审核`,
// `待确认`≡`确认`, fresh≡`待处理`. Chip pills, main-button copy and
// composer placeholders measured from the r7 captures (23 light/dark, 16
// light, 17 light/dark) and r5b §3.3/§3.6 + r6 §4.4 (main-button copy
// table incl. `重开`). Rows no capture exercises carry [推断].

import type { Phase } from './fixtures/records.js';

export interface PhaseUi {
  /** Status chip word. */
  chip: string;
  /** Chip color tone. */
  tone: 'idle' | 'plan' | 'confirm' | 'done' | 'failed';
  /** Header primary button copy; null = no button (planning/building). */
  action: string | null;
  /** Composer textarea placeholder; null = no composer (fresh). */
  placeholder: string | null;
  /** 文档|聊天 tab group visible from planning on (r7 23 shows none). */
  tabs: boolean;
}

export const PHASE_UI: Record<Phase, PhaseUi> = {
  todo: { chip: '待处理', tone: 'idle', action: '开始', placeholder: null, tabs: false },
  queued: { chip: '待处理', tone: 'idle', action: '开始', placeholder: null, tabs: false },
  planning: {
    chip: '规划中',
    tone: 'plan',
    action: null,
    placeholder: '向 Agent 补充说明，执行过程中即可送达',
    tabs: true,
  },
  confirm: { chip: '确认', tone: 'confirm', action: '确认', placeholder: '请求修改…', tabs: true },
  // building chip copy from the r7 26 capture (`执行中`); failed/closed
  // rows stay [推断] (no capture exercises them).
  building: {
    chip: '执行中',
    tone: 'plan',
    action: null,
    placeholder: '向 Agent 补充说明，执行过程中即可送达',
    tabs: true,
  },
  review: { chip: '审核', tone: 'confirm', action: '完成', placeholder: '请求修改…', tabs: true },
  // done drops the composer (r7 36/36d show none) — placeholder null
  done: { chip: '已完成', tone: 'done', action: '重开', placeholder: null, tabs: true },
  // r8 54/73 (dual-subject canon): red chip `失败`, header primary `重跑`,
  // composer keeps the writable-review placeholder but drops the AI 审核
  // tool (r8 §3.1). Board card word differs (`重试`, columns.ts).
  failed: {
    chip: '失败',
    tone: 'failed',
    action: '重跑',
    placeholder: '请求修改…',
    tabs: true,
  },
  closed: { chip: '待处理', tone: 'idle', action: null, placeholder: null, tabs: false },
};
