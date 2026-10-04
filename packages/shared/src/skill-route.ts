// 发送后 skill 路由的纯匹配层（#823 纠正方向：收单之后、claim 时由服务端
// 检测，输入时 UI 一个不动）。无 I/O、无扫盘——调用方（server buildChiefClaim）
// 传入现扫技能清单，本模块只做归一 + 规则判定。首批两规则，多了不加（误触发
// 可逆是第一要求：普通对话必须落回 null）。
//
// - explicit-mention：用户报出已装技能的 id/name 原样（含中文名），精度最高优先；
// - reminder：时间表达 + 提醒动词双信号（缺一不可），候选技能按提醒关键词在
//   已装技能 id/name/description 里 containment 匹配，无已装技能时回落内置
//   set_wake/schedule_todo（用户原话"明早 9 点提醒我"开箱可用）。

/** 路由输入的技能投影（server scanLocalSkills 同形子集）。 */
export interface RouteSkillRef {
  id: string;
  name: string;
  description: string | null;
}

export type SkillRouteRuleId = 'reminder' | 'explicit-mention';

export interface SkillRouteHint {
  ruleId: SkillRouteRuleId;
  /** 命中的已装技能（确定性 id 序）；空 = 无切合已装技能（仅 reminder 回落时）。 */
  skills: RouteSkillRef[];
  /** 内置能力回落（现仅 reminder 有；null = 无回落）。 */
  toolHint: string | null;
}

/** 归一：NFKC（全半角/全角标点统一）+ 小写 + 去空白与标点（CJK 子串直配）。 */
function normalizeForMatch(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}]/gu, '');
}

/** wake 轮系统触发 prompt 标记（与 chief WAKE_PROMPT_PREFIX 同形，调用方另有
 * trigger 门，本处纵深防御——系统 prompt 永不产出路由提示）。 */
const WAKE_PREFIX_RE = /^\[wake:\w+\]/;

/** 时间表达（首批：中文口语时间 + 钟点 + 相对延时 + 周期）。 */
const TIME_EXPR_RE =
  /明早|明天|今晚|今早|后天|大后天|下周|下月|下个月|周[一二三四五六日天]|星期[一二三四五六日天]|每天|每周|每月|\d+点|\d+:\d+|早上|中午|下午|晚上|凌晨|半夜|分钟后|小时后|天后|准时|按时|定时/;

/** 提醒动词（首批：中文提醒口语 + 英文对等词）。 */
const REMINDER_VERB_RE = /提醒|闹钟|叫我|喊我|通知我|别忘|勿忘|记得|记住|到时|届时|remind|alarm/;

/** 提醒类技能的已装侧关键词（containment 匹配已装技能 id/name/description）。 */
const REMINDER_SKILL_KEYWORDS = [
  '提醒',
  '定时',
  '闹钟',
  '日程',
  'remind',
  'schedul',
  'wake',
  'alarm',
];

const REMINDER_TOOL_HINT = 'set_wake（到点回头核实汇报）/ schedule_todo（定时重跑任务）';

function matchReminderSkills(installed: RouteSkillRef[]): RouteSkillRef[] {
  return installed
    .filter((s) => {
      const hay = normalizeForMatch(`${s.id} ${s.name} ${s.description ?? ''}`);
      return REMINDER_SKILL_KEYWORDS.some((k) => hay.includes(k));
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function matchExplicitMention(normText: string, installed: RouteSkillRef[]): RouteSkillRef[] {
  const out: RouteSkillRef[] = [];
  for (const s of installed) {
    const keys = [normalizeForMatch(s.id), normalizeForMatch(s.name)];
    if (keys.some((k) => k.length >= 2 && normText.includes(k))) out.push(s);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** 用户消息 → 路由提示（null = 不命中，调用方不附加任何节）。 */
export function suggestSkillsForMessage(
  text: string,
  installed: RouteSkillRef[],
): SkillRouteHint | null {
  if (WAKE_PREFIX_RE.test(text)) return null;
  const norm = normalizeForMatch(text);
  if (norm === '') return null;
  // 精确优先：用户显式点名已装技能。
  const mentioned = matchExplicitMention(norm, installed);
  if (mentioned.length > 0) {
    return { ruleId: 'explicit-mention', skills: mentioned, toolHint: null };
  }
  // 意图规则：时间表达 + 提醒动词双信号，缺一不可。
  if (TIME_EXPR_RE.test(norm) && REMINDER_VERB_RE.test(norm)) {
    return {
      ruleId: 'reminder',
      skills: matchReminderSkills(installed),
      toolHint: REMINDER_TOOL_HINT,
    };
  }
  return null;
}

const RULE_LABEL: Record<SkillRouteRuleId, string> = {
  reminder: '提醒意图（时间表达 + 提醒动词）',
  'explicit-mention': '显式点名已装技能',
};

/** 提示节组装（恒为"建议"措辞：agent 先用 skills 工具核对详情，不切合直接
 * 忽略；普通对话永不强行调用——误触发的代价只是一节可忽略的文本）。 */
export function formatSkillRouteSection(hint: SkillRouteHint): string {
  const lines = [
    '## 技能路由提示（发送后自动检测，仅建议——先核对再用）',
    `用户消息命中「${RULE_LABEL[hint.ruleId]}」。以下候选仅供参考：`,
  ];
  for (const s of hint.skills) {
    lines.push(
      `- 技能 ${s.id}${s.description ? ` — ${s.description}` : ''}（用 skills 工具核对详情；切合才用，不切合直接忽略）`,
    );
  }
  if (hint.toolHint !== null) {
    lines.push(`- 内置能力：${hint.toolHint}（无切合技能时走此路；同样先确认用户真想要定时动作）`);
  }
  lines.push('普通对话直接忽略本节，绝不强行调用技能。');
  return lines.join('\n');
}
