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
