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

/** 单文件字节上限（写面与 web 文本读面共用一闸：REST/relay 写入按 content
 * 字节计，web 现读按盘上 st.size 计——同一常量单源，XMON-109 前该值是
 * server 私有常量，写路径进 shared 后上提。machine-wire 分发面自 #920 起
 * 不受本闸约束：清单 + 按需拉，单文件单请求 + sha256 逐文件校验）。 */
export const MAX_SKILL_FILE_BYTES = 512_000;

/** 单技能总字节上限（XMON-109 写路径新设：批量文件写入前总量闸。
 * machine-wire 下发面自 #920 起不再设总量闸——旧「一次 GET 塞全量全文」
 * 的整包预算约束随清单 + 按需拉解体）。 */
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

/** POST /api/teams/{id}/skills/import body（#1170）：localPath 与 url 二选一
 * ——localPath = server 本机技能目录（须含 SKILL.md），url = GitHub 公共仓/
 * 子目录。xor 由 refine 钉（双缺/双给 = 400）；分支语义与 SSRF/路径守卫归
 * server services/skill-import.ts（本 schema 只钉形状）。 */
export const importSkillBodySchema = z
  .object({
    localPath: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
  })
  .refine((b) => (b.localPath !== undefined) !== (b.url !== undefined), {
    message: 'invalid body: exactly one of localPath or url is required',
  });
export type ImportSkillBody = z.infer<typeof importSkillBodySchema>;

/** 技能目录名安全域（create 的 body.name = 新目录名）：字母/数字开头，仅
 * 字母数字点横杠下划线，≤64 字符——可作 URL 段与跨平台目录名。XMON-114 自
 * server services/skills.ts 上提：web 表单预检与 server 写面校验同一闸。 */
export const SKILL_DIR_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** SKILL.md frontmatter 最小解析（XMON-114 自 server services/skills.ts 上提
 * ——web 编辑面预填/回读对拍与 server 写面校验消费同一解析器，防双侧漂移）：
 * 仓内无 yaml 依赖，单行为值、可引号包裹；折叠块标量标记（`>`/`|` 族）与
 * 多行值不受理 = 按缺省回落（真打 anthropics/skills 实测 academy-guide 即
 * `description: >` 折叠形，语义承自旧 GitHub 扫描面 #223）。 */
export function parseSkillFrontmatter(content: string): {
  name?: string;
  description?: string;
} {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  const block = m?.[1];
  if (block === undefined) return {};
  const out: { name?: string; description?: string } = {};
  for (const line of block.split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    const key = kv?.[1];
    if (key !== 'name' && key !== 'description') continue;
    const value = (kv?.[2] ?? '')
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2')
      .trim();
    // 折叠/文字块标量标记（>、|、>-、|+…）= 多行值，最小解析器不受理 → 缺省回落。
    if (value !== '' && !/^[>|][+-]?$/.test(value)) out[key] = value;
  }
  return out;
}

/** SKILL.md 入口文件拆分（XMON-114 web 编辑面预填）：frontmatter 字段 +
 * 正文（frontmatter 块之后的原文，剥前导空行）。无 frontmatter 块 = 全部
 * 归 body（与 parseSkillFrontmatter 空洞同律）。 */
export function splitSkillEntry(content: string): {
  name?: string;
  description?: string;
  body: string;
} {
  const m = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(content);
  if (m === null) return { body: content };
  // 只剥前导空行——正文首行的缩进（如整段代码块）是内容本体，不动。
  return {
    ...parseSkillFrontmatter(content),
    body: content.slice(m[0].length).replace(/^(\r?\n)+/, ''),
  };
}

/** SKILL.md 入口文件组装（XMON-114 web 表单面：name/description 表单化 →
 * frontmatter 由本函数生成，用户只写正文）。正文首尾空白收敛 + 单换行收尾，
 * 回读对拍（parseSkillFrontmatter(build(...)) 与入参逐字段一致）在调用方。 */
export function buildSkillEntry(name: string, description: string, body: string): string {
  const head = `---\nname: ${name}\ndescription: ${description}\n---\n`;
  const trimmed = body.trim();
  return trimmed === '' ? head : `${head}\n${trimmed}\n`;
}

/** 页文案 canon（spec 13 + XMON-109 回摆：双入口口径——放目录进技能根、
 * 或页面/relay 新建，都会出现在这里；{dir} = SKILLS_DIR_DEFAULT 显示位。
 * 单源消费：web resources/skills-page.tsx 经 t() 渲染本常量（i18n-coverage
 * COMPUTED_KEYS 登记），en 翻译在 apps/web i18n 词典以同串为键）。 */
export const SKILL_PAGE_COPY = {
  empty: '尚无技能。',
  directoryHint: '把包含 SKILL.md 的技能目录放进 {dir}，或新建一个技能，即会出现在这里。',
} as const;
