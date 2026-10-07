// 技能事实（#918）：从工具调用流识别「读了哪些技能」的纯分类层。判定源 =
// 工具事实（读了哪些 SKILL.md / 调了哪些 Skill 工具、结果是否被拒），不是
// agent 自述——与「要证据不要说法」同律。daemon（活行实时条目）与 web
// （详情页汇总，从落库 toolcall 行派生）共用本单源，两面判定永不漂移。
// 失败方式枚举见 test/skill-facts.test.ts（S1–S8）。
//
// 识别面 = 三个已知工具词（backend 词表实测）：
//   - pi `read`（arguments.path）——catalog 指引 agent 直读 SKILL.md；
//   - claude-code `Read`（arguments.file_path）——同上；
//   - claude-code `Skill`（arguments.skill / .command）——原生技能调用
//     （SKILL.md 加载不经 Read 权限面，docs/verify/917 probe B4 实测）。
// deny 判定 = isError（pi 门控 read 的 tool error 文案与 claude-code deny
// 规则的 is_error tool_result 同律）；接受的边界见 S6 注记。

import { z } from 'zod';
import type { ToolCallRecord } from './agent-backend.js';

/** 一条技能事实：技能名 + 是否被挡下（deny）。顺序 = 首见序（消费侧律）。 */
export const skillFactSchema = z.object({
  name: z.string().min(1),
  denied: z.boolean(),
});
export type SkillFact = z.infer<typeof skillFactSchema>;

/** 技能入口文件的正典名（大小写敏感，S4）。 */
const SKILL_FILE = 'SKILL.md';

/** 路径切分（POSIX + Windows 分隔符，S7）。 */
function segmentsOf(path: string): string[] {
  return path.split(/[\\/]/);
}

function stringArg(args: unknown, key: string): string | null {
  if (args === null || typeof args !== 'object') return null;
  const v = (args as Record<string, unknown>)[key];
  return typeof v === 'string' && v !== '' ? v : null;
}

/** 调用是否技能入口 + 技能名（进行态可判：不依赖 result——活行头标签的
 *  显示名用）。null = 非技能调用。
 *  - Read/read：路径末段恰为 SKILL.md 且存在父目录段（裸 `SKILL.md` 无名可取，
 *    S7）；名 = 直接父目录段（catalog 的技能目录名）。
 *  - Skill：`skill:` 前缀剥掉（CLI 两形并存，S3）。 */
export function skillCallName(call: ToolCallRecord): string | null {
  const tool = call.name;
  if (tool === 'Skill') {
    const raw = stringArg(call.arguments, 'skill') ?? stringArg(call.arguments, 'command');
    if (raw === null) return null;
    const stripped = raw.startsWith('skill:') ? raw.slice('skill:'.length) : raw;
    return stripped === '' ? null : stripped;
  }
  if (tool !== 'Read' && tool !== 'read') return null;
  const path = stringArg(call.arguments, 'file_path') ?? stringArg(call.arguments, 'path');
  if (path === null) return null;
  const segs = segmentsOf(path);
  if (segs.at(-1) !== SKILL_FILE) return null;
  const parent = segs.at(-2);
  return parent === undefined || parent === '' ? null : parent;
}

/** 终态技能事实（result 在位才判：读取完成才是事实，S5）。denied = isError
 *  （S6）。null = 非技能调用或尚未终态。 */
export function classifySkillFact(call: ToolCallRecord): SkillFact | null {
  if (call.result === undefined) return null;
  const name = skillCallName(call);
  if (name === null) return null;
  return { name, denied: call.isError === true };
}
