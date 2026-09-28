// skill record——CONTEXT.md：含 SKILL.md 的可复用流程文件夹，传授给 Agent；
// Agent 可默认携带或被授予。spec 13 资源面本地化（#367）：技能 = 本地目录
// 现扫的只读投影，不入库——server 每次 GET /api/skills?teamId= 现扫配置的
// 技能根目录（ENV_VARS.skillsDir，缺省 SKILLS_DIR_DEFAULT），每个含 SKILL.md
// 的一级子目录 = 一个技能。
// 身份模型（2026-09-29 合同修订，对齐 spec 14 daemon 注入契约）：
// id = SKILL.md frontmatter name，无 frontmatter / 无 name 字段回落目录名
// （agentskills.io / pi v0.86.0 同律：frontmatter.name 主键 + realpath 去重；
// 目录重命名不影响 skill 身份）。
// wire 形状保留 { id, teamId, name, description }（收窄 web 改动面）：
// teamId = 当前请求 team 占位；name 与 id 同源（frontmatter name 回落目录名）。

import { z } from 'zod';
import { recordId } from './common.js';

/** 入口文件 canon（r2 §6.1：「必须包含 SKILL.md」）。 */
export const SKILL_ENTRY_FILE = 'SKILL.md';

/** 技能根目录缺省值（spec 13：`~/.agents/skills`）。server config 展开 `~`
 * 前缀（ENV_VARS.skillsDir 可覆写）；web 空态文案 {dir} 插值消费同一常量——
 * 缺省路径单源在此。 */
export const SKILLS_DIR_DEFAULT = '~/.agents/skills';

export const skillRecordSchema = z.object({
  /** frontmatter name（回落目录名）——稳定身份键，agent.skills[] 同值域。 */
  id: recordId,
  /** 当前请求 team 占位（技能本体不分队，spec 13 单源本地目录）。 */
  teamId: recordId,
  name: z.string(), // 与 id 同源：frontmatter name 回落目录名
  description: z.string().nullable(), // frontmatter description 回落 null
});
export type SkillRecord = z.infer<typeof skillRecordSchema>;

/** 页文案 canon（spec 13：只读面——空态指路技能目录，无导入/新建动作；
 * {dir} = SKILLS_DIR_DEFAULT 显示位。web 渲染位 = resources/skills-page.tsx
 * 字面量镜像，en 翻译在 apps/web i18n 词典）。 */
export const SKILL_PAGE_COPY = {
  empty: '尚无技能。',
  directoryHint: '把包含 SKILL.md 的技能目录放进 {dir}，即会出现在这里。',
} as const;
