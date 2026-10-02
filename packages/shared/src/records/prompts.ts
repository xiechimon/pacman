// 系统合成 prompt 词表（#612）：transcript 的 role-user wire 行不全是用户
// 的话——daemon 把任务文本（title+spec）与续轮指令记进会话（runner.ts），
// server 把 replan/restart 反馈指令与审核材料记进会话（builds.ts）。呈现层
// （web mapTranscript）需要按本词表把合成行从用户话语里择出去，否则它们以
// 用户气泡冒名顶替（任务原文还会与描述区双渲染）。写侧与过滤侧单源在此，
// 文本逐字节即 wire 值——改任何一个字符串都是改双端契约。
//
// 宣告行（MERGE_ANNOUNCEMENT / REVIEW_ANNOUNCEMENT，message.ts）不在本词表：
// 它们是要渲染的行（note 家族），不是要消失的行。

import { parseReviewPromptMeta } from './review.js';
import type { StepKind } from './step.js';

/** 任务文本（daemon buildTaskPrompt 单源）：title + spec 原文，new session
 *  首轮 prompt。 */
export function buildTaskPromptText(title: string, spec: string): string {
  return `${title}\n\n${spec}`;
}

/** continue session 续轮指令（daemon 步 kind → prompt 单源；chief/review 走
 *  instruction 分支，本表保占位空串防 TS 缺键）。 */
export const CONTINUE_PROMPTS: Record<StepKind, string> = {
  plan: '请重新规划该任务，输出更新后的方案。',
  build: '方案已确认。请按方案执行，完成改动。',
  merge: '请把本会话分支的改动合并到默认分支。',
  chief: '',
  review: '',
};

const REPLAN_HEAD = '用户对方案提出驳回。驳回反馈：「';
const REPLAN_TAIL =
  '」。请忠实按反馈调整方案，输出更新后的 plan.md（覆盖 Context/Changes/Edge cases/Verification 四段），并在结尾一句话摘要本次调整了什么。';

/** 驳回重规划指令（server revision 分支单源）：feedback 内嵌，用户的
 *  feedback 原文另有独立 wire 行在先。 */
export function buildReplanPrompt(feedback: string): string {
  return `${REPLAN_HEAD}${feedback}${REPLAN_TAIL}`;
}

const RESTART_HEAD = '上一轮执行失败。用户反馈：「';
const RESTART_TAIL =
  '」。请把反馈纳入本轮：涉及方案先输出更新后的 plan.md（覆盖 Context/Changes/Edge cases/Verification 四段），再忠实执行完成任务。';

/** 失败重启指令（server restart 分支单源）：feedback 内嵌，且 feedback 原文
 *  已作为独立 wire 行落新会话首条。 */
export function buildRestartPrompt(feedback: string): string {
  return `${RESTART_HEAD}${feedback}${RESTART_TAIL}`;
}

/** 非空续轮指令集（chief/review 的占位空串不入集——空文本行由呈现层自有
 *  规则跳过，不属「合成 prompt」语义）。 */
const SYNTHETIC_EXACT: ReadonlySet<string> = new Set(
  Object.values(CONTINUE_PROMPTS).filter((v) => v !== ''),
);

function wrappedBy(text: string, head: string, tail: string): boolean {
  return text.length >= head.length + tail.length && text.startsWith(head) && text.endsWith(tail);
}

/** role-user wire 行文本的归属判定：
 *  - `task-prompt` = 任务文本（title+spec 合成，与 todo 当前值精确相等）——
 *    任务简报的重复呈现，描述区是用户原话的唯一展示面；
 *  - `synthetic` = 其余合成指令（续轮/replan/restart 模板、审核材料——审核
 *    材料首行是 review prompt meta JSON，records/review.ts 单源解析）；
 *  - `user` = 真实用户话语（steer/驳回 feedback/重启 feedback），呈现层照常
 *    渲染成用户气泡。
 *  宣告行不在此判定（见文件头）；调用方先行分流。 */
export type UserTextKind = 'task-prompt' | 'synthetic' | 'user';

export function classifyUserText(
  text: string,
  task: { title: string; spec: string },
): UserTextKind {
  // wire 行经呈现层 trim 后比对（daemon 记录的是未 trim 原文）。
  if (text === buildTaskPromptText(task.title, task.spec).trim()) return 'task-prompt';
  if (SYNTHETIC_EXACT.has(text)) return 'synthetic';
  if (wrappedBy(text, REPLAN_HEAD, REPLAN_TAIL)) return 'synthetic';
  if (wrappedBy(text, RESTART_HEAD, RESTART_TAIL)) return 'synthetic';
  if (parseReviewPromptMeta(text) !== null) return 'synthetic';
  return 'user';
}
