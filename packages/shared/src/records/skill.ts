// skill record——CONTEXT.md：含 SKILL.md 的可复用流程文件夹，传授给 Agent；
// Agent 可默认携带或被授予。端点（02 §6.1）：GET /api/skills?teamId=、
// GET /api/teams/{id}/skills/{sid}(+/file?fileName=)、POST /api/skills（上传）；
// 01 §6 表注：含文件内容（`skills/{sid}/file` 端点源）。
// wire 形状未实测；字段证据 = r2 §6.1 表单（名称/描述/技能文件夹必须包含
// SKILL.md，或 GitHub 导入），[推断] 投影。

import { z } from 'zod';
import { recordId } from './common.js';

/** 入口文件 canon（r2 §6.1：「必须包含 SKILL.md」）。 */
export const SKILL_ENTRY_FILE = 'SKILL.md';

export const skillRecordSchema = z.object({
  id: recordId,
  teamId: recordId,
  name: z.string(), // 表单 ph `例如：deploy`（r2 §6.1）
  description: z.string().nullable(), // ph `简要描述该技能的功能`
});
export type SkillRecord = z.infer<typeof skillRecordSchema>;

/** 页文案 canon（r2 §6.1 原文）。 */
export const SKILL_PAGE_COPY = {
  empty: '尚无技能。',
  definition:
    '技能是写给 Agent 的工作手册：一个包含 SKILL.md 的文件夹，用于将可复用的流程传授给 Agent。授予后，Agent 会在合适的任务中主动使用。',
  chiefHint: '你也可以直接让总管从 GitHub 安装技能，或帮你制作新技能。',
} as const;

// —— POST /api/skills/scan（#223：skills 导入面 GitHub tab「扫描」发现半，
// #201 裁决路线 A = server 长 GitHub REST/Trees 出站 fetch）——词表外观测外
// 新端点（原产品扫描钮 wire 未采），形状 [设计]：server 侧语义单源。
// 双模式：缺省 path = scan（候选发现）；给 path = fetch（取回该技能目录文件集，
// 文件集 Record 与 POST /api/skills body.files 同形，选中后直接喂导入半）。

export const scanSkillsBodySchema = z.object({
  teamId: z.string().optional(),
  /** GitHub 仓：`owner/repo` 或 https://github.com/owner/repo（可带 .git/尾斜杠）。 */
  repo: z.string().min(1),
  /** 技能目录（相对仓根，'' = 仓根本身是技能）；给定即 fetch 模式。 */
  path: z.string().optional(),
});
export type ScanSkillsBody = z.infer<typeof scanSkillsBodySchema>;

export const skillCandidateSchema = z.object({
  /** 技能目录（相对仓根；'' = 仓根）。 */
  path: z.string(),
  /** SKILL.md frontmatter name；缺省回落 = 目录名。 */
  name: z.string(),
  /** SKILL.md frontmatter description；缺省 = null。 */
  description: z.string().nullable(),
});
export type SkillCandidate = z.infer<typeof skillCandidateSchema>;

/** scan 模式响应（候选列表 + 截断标志：上游树截断或候选超上限 = 部分结果）。 */
export const scanSkillsResponseSchema = z.object({
  /** 归一 `owner/repo`。 */
  repo: z.string(),
  defaultBranch: z.string(),
  candidates: z.array(skillCandidateSchema),
  truncated: z.boolean(),
});
export type ScanSkillsResponse = z.infer<typeof scanSkillsResponseSchema>;

/** fetch 模式响应（文件集即 POST /api/skills body.files 同形——键相对技能目录）。 */
export const fetchSkillFilesResponseSchema = z.object({
  repo: z.string(),
  path: z.string(),
  files: z.record(z.string(), z.string()),
});
export type FetchSkillFilesResponse = z.infer<typeof fetchSkillFilesResponseSchema>;
