// AI 审核 findings 数据形态（M7 #330，r8 §3.1：审核消息「结论先行 + 编号
// findings + (blocking) 标记 + 引用方案块」+ blocking → agent 自动修订）。
// step 表无 agentId 列（r3 schema 投影未采 — review 步的 agentId 经 prompt
// 透出 + claim 载荷传机器；DB 不冗余；apps/server/test/review.test.ts 已钉
// 此口径）——agentId 在 review 步 prompt 头一行 JSON 元数据里携带，本文件
// 顺带承担 prompt meta header 的解析形态单源（不落库只走 wire）。

import { z } from 'zod';

/** severity 词表（r8 §3.1 实测：blocking / suggestion / info 三值）。 */
export const reviewSeveritySchema = z.enum(['blocking', 'suggestion', 'info']);
export type ReviewSeverity = z.infer<typeof reviewSeveritySchema>;

/** 单条 finding（r8 §3.1：编号 + 严重度 + 引用位（文件:行）+ 摘要 + 可选
 * 建议）。summary = 标题行；description = 解释段；suggestion = 可选修复建议
 * 段——三条都是纯文本（与 r8 §3.1 渲染层拼装一致，不发明嵌套结构）。 */
export const reviewFindingSchema = z.object({
  /** 稳定 id（呈现层编号排序键；服务端写库时建议 1..N 自然序生成）。 */
  id: z.string(),
  severity: reviewSeveritySchema,
  /** finding 标题（r8 60/65：finding 段第一行；与 description 段区分）。 */
  summary: z.string(),
  /** finding 解释段（r8 60：finding 段第二行；多行按 \n 拆段渲染）。 */
  description: z.string().optional(),
  /** 引用文件路径（r8 60/65：file 字段；缺省 = 无引用）。 */
  file: z.string().optional(),
  /** 文件内行号（r8 60/65：file:line 形式；缺省 = 仅文件）。 */
  line: z.number().int().positive().optional(),
  /** 建议修复段（r8 60/65：建议段；缺省 = 无建议）。 */
  suggestion: z.string().optional(),
});
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;

/** 完整审核结论（agent 终轮输出）；conclusion = 一段总结 + findings = 编号
 * 列表（r8 §3.1：结论先行 + 编号 findings）。 */
export const reviewVerdictSchema = z.object({
  /** 一段总结（r8 60：审核消息首段；方案是否通过 + 概览）。 */
  conclusion: z.string(),
  /** 编号 findings（按 id 升序；缺省 = 仅结论无 findings，含义 = 方案
   * 通过）。blocking 项触发 server 端自动修订回路。 */
  findings: z.array(reviewFindingSchema).default([]),
});
export type ReviewVerdict = z.infer<typeof reviewVerdictSchema>;

// —— review 步 prompt 元数据头（agentId 透传载体）————————————————————————

/** review 步 prompt 第一行 JSON meta 形状：kind + agentId（claim 载荷走
 * 该 agentId 拉取执行 Agent；DB 不冗余）。daemon 解析同型，单源在本文件。 */
export const reviewPromptMetaSchema = z.object({
  kind: z.literal('review'),
  agentId: z.string(),
});
export type ReviewPromptMeta = z.infer<typeof reviewPromptMetaSchema>;

/** 从 prompt 头行解析 review 元数据（首行 = JSON；余下 = 任务文本）。
 * 解析失败 = null（调用方回退 assignment 槽；plan/build/chief 不带本头）。 */
export function parseReviewPromptMeta(prompt: string | null): ReviewPromptMeta | null {
  if (prompt === null) return null;
  const newline = prompt.indexOf('\n');
  const head = (newline === -1 ? prompt : prompt.slice(0, newline)).trim();
  if (!head.startsWith('{')) return null;
  try {
    const parsed = reviewPromptMetaSchema.safeParse(JSON.parse(head));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** 组装 review 步 prompt（meta header + JSON 输出契约 + plan 全文 + 用户
 * 关注点）。调用方写库到 step.prompt；claim 时解析取 agentId。 */
export function buildReviewStepPrompt(args: {
  agentId: string;
  planText: string;
  focus?: string;
}): string {
  const meta: ReviewPromptMeta = { kind: 'review', agentId: args.agentId };
  const focusNote =
    args.focus !== undefined && args.focus.trim() !== ''
      ? `\n\n## 用户关注点\n${args.focus.trim()}`
      : '';
  return [
    JSON.stringify(meta),
    // r8 §3.1：审核 = 只读，不修改 worktree；如有 blocking 风险请明确标注。
    [
      '请审核以下方案。**只审核、不修改 worktree、不动 plan.md**；',
      '如有 blocking 风险请明确标注，suggestion / info 请按需给出。',
    ].join(''),
    '',
    '## 输出契约',
    '本步以单一 JSON 对象结尾输出 findings —— 你的最后一条消息内容必须是下列',
    '形式的合法 JSON（可前置解释性段落，但最后一段必须且仅能是这段 JSON）：',
    '```json',
    JSON.stringify(
      {
        conclusion: '<一句话结论：方案是否通过、关键风险概览>',
        findings: [
          {
            id: '1',
            severity: 'blocking | suggestion | info',
            summary: '<finding 标题>',
            description: '<finding 解释>',
            file: '<可选：受影响文件相对路径>',
            line: '<可选：受影响行号>',
            suggestion: '<可选：修复建议>',
          },
        ],
      },
      null,
      2,
    ),
    '```',
    '',
    '## 待审核方案',
    args.planText,
    focusNote,
  ].join('\n');
}

/** 判断 verdict 是否含 blocking finding（blocking → 触发自动修订回路）。 */
export function hasBlockingFinding(verdict: ReviewVerdict): boolean {
  return verdict.findings.some((f) => f.severity === 'blocking');
}
