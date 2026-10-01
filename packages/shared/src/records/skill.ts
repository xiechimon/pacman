// skill record——CONTEXT.md：含 SKILL.md 的可复用流程文件夹，传授给 Agent；
// Agent 可默认携带或被授予。spec 13 资源面本地化（#367）：技能 = 本地目录
// 现扫的投影，不入库——server 每次 GET /api/skills?teamId= 现扫配置的
// 技能根目录（ENV_VARS.skillsDir，缺省 SKILLS_DIR_DEFAULT），每个含 SKILL.md
// 的一级子目录 = 一个技能。XMON-109（spec 13 回摆）：写路径进 scope——
// REST（member）+ worker relay（agent 行「创建技能/更新技能」开关执法）+
// chief relay（免开关）三入口写同一目录树，REST/relay 双面写均落 skill_audit
// 审计行（server 表，无 wire record 投影）。
// 身份模型（2026-09-29 合同修订，对齐 spec 14 daemon 注入契约）：
// id = SKILL.md frontmatter name，无 frontmatter / 无 name 字段回落目录名
// （agentskills.io / pi v0.86.0 同律：frontmatter.name 主键 + realpath 去重；
// 目录重命名不影响 skill 身份）。写面同律：create 的 body.name 即目录名且
// 须与 frontmatter name 一致；update 改名 = 携带新 SKILL.md（frontmatter 是
// 唯一真值，目录不动、id 随 frontmatter 走）。
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

/** 单文件字节上限（写面与读面共用一闸：REST/relay 写入按 content 字节计，
 * 现读按盘上 st.size 计——同一常量单源，XMON-109 前该值是 server 私有
 * 常量，写路径进 shared 后上提）。 */
export const MAX_SKILL_FILE_BYTES = 512_000;

/** 单技能（或 machine-wire 单包）总字节上限（XMON-109 写路径新设：批量
 * 文件写入/下发前总量闸；包面 = agent.skills 白名单交集的技能集合总量）。 */
export const MAX_SKILL_TOTAL_BYTES = 2_000_000;

export const skillRecordSchema = z.object({
  /** frontmatter name（回落目录名）——稳定身份键，agent.skills[] 同值域。 */
  id: recordId,
  /** 当前请求 team 占位（技能本体不分队，spec 13 单源本地目录）。 */
  teamId: recordId,
  name: z.string(), // 与 id 同源：frontmatter name 回落目录名
  description: z.string().nullable(), // frontmatter description 回落 null
});
export type SkillRecord = z.infer<typeof skillRecordSchema>;

/** 写面单文件行（XMON-109 S1：files[] 条目——path = 技能目录内相对路径，
 * content = 文本内容原样落盘）。 */
export const skillFileBodySchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});
export type SkillFileBody = z.infer<typeof skillFileBodySchema>;

/** POST /api/skills body（XMON-109 S1，spec 13 回摆）+ worker/chief relay
 * create_skill params 同形。name = 目录名（也是 SKILL.md frontmatter name，
 * 两者必须一致——frontmatter 是唯一真值，body 声明只是与之对拍的冗余）；
 * description 同律；files 至少一件且必须含 SKILL.md。 */
export const createSkillBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  files: z.array(skillFileBodySchema).min(1),
});
export type CreateSkillBody = z.infer<typeof createSkillBodySchema>;

/** PUT /api/teams/{id}/skills/{sid} body——与 create 同形（全量声明 + 覆写
 * 语义：列出者覆写、未列者保留）。改 frontmatter（含改名）必须携带新
 * SKILL.md；不携带时 body 的 name/description 声明必须与现 frontmatter
 * 一致（防隐式改身份）。 */
export const updateSkillBodySchema = createSkillBodySchema;
export type UpdateSkillBody = CreateSkillBody;

/** relay update_skill params（XMON-109 S1）：update body + skillId（URL 段
 * 在 relay 面进 params）。 */
export const updateSkillToolParamsSchema = updateSkillBodySchema.extend({
  skillId: z.string().min(1),
});
export type UpdateSkillToolParams = z.infer<typeof updateSkillToolParamsSchema>;

/** 页文案 canon（spec 13 + XMON-109 回摆：双入口口径——放目录进技能根、
 * 或页面/relay 新建，都会出现在这里；{dir} = SKILLS_DIR_DEFAULT 显示位。
 * 单源消费：web resources/skills-page.tsx 经 t() 渲染本常量（i18n-coverage
 * COMPUTED_KEYS 登记），en 翻译在 apps/web i18n 词典以同串为键）。 */
export const SKILL_PAGE_COPY = {
  empty: '尚无技能。',
  directoryHint: '把包含 SKILL.md 的技能目录放进 {dir}，或新建一个技能，即会出现在这里。',
} as const;
