// Natural-language skill auto-suggest (issue #823).
//
// When the user types plain prose ("明早 9 点提醒我"), pacman matches the
// draft against a first-batch trigger table and suggests the best team
// skill as a ghost hint bar (Tab accepts). The candidate pool is ALWAYS
// the caller's skill vocab (the same `useSkills` projection that feeds the
// mention picker and the `/` menu) — this module builds no side table, so
// a team without a matching skill simply gets no suggestion.
//
// Home is shared (not apps/web/src) on purpose: the trigger phrases are
// matcher data, not UI copy, so they stay out of the web i18n-coverage
// gate (every CJK literal under apps/web/src must be an en-dict key).
// Pure logic, no React — both the web composer wire and future server
// consumers import it from here.
//
// Deliberately NOT here: key handling and rendering. The composer wire
// suppresses the suggestion while the `/` or `@` menus are open and owns
// the Tab-accept key, so the three faces never steal each other's keys;
// the skin lives with the composer faces.

export interface SuggestSkillEntry {
  id: string;
  name: string;
  description?: string;
}

export interface SkillSuggestion {
  skillId: string;
  skillName: string;
  intentId: string;
}

interface TriggerIntent {
  id: string;
  /** Draft-side trigger phrases (matched case-insensitively, substring). */
  triggers: string[];
  /** Skill-side keywords: a skill matches when its name or description
   *  contains any of these (case-insensitive). */
  skillKeywords: string[];
}

/** First-batch trigger table (#823:首批映射，不许全量). Order = priority:
 *  a draft hitting several intents suggests the earliest one. */
const TRIGGER_INTENTS: TriggerIntent[] = [
  {
    id: 'reminder',
    triggers: [
      '提醒',
      '闹钟',
      '定时',
      '明早',
      '今晚',
      '明天',
      '后天',
      '每天',
      '每周',
      'deadline',
      'remind',
      'schedule',
      'cron',
      'alarm',
      'notify me',
      '点提醒',
      '点叫我',
    ],
    skillKeywords: ['remind', 'schedule', 'cron', 'notif', 'alarm', '提醒', '定时', '日程'],
  },
  {
    id: 'translate',
    triggers: ['翻译', '译成', '翻成', 'translate', 'translation'],
    skillKeywords: ['translat', '翻译'],
  },
  {
    id: 'summarize',
    triggers: ['总结', '摘要', '归纳', 'summar', 'tl;dr'],
    skillKeywords: ['summar', '总结', '摘要'],
  },
  {
    id: 'review',
    triggers: ['代码审查', 'review', 'code review', '审核一下', '帮我看一下代码', '检查一下代码'],
    skillKeywords: ['review', '审查', 'lint'],
  },
];

/** True when the draft already references the skill — either as a slash
 *  token (`/name`) or as an inserted mention (`[label](skill:id)`). */
function alreadyReferenced(draft: string, skill: SuggestSkillEntry): boolean {
  const lowered = draft.toLowerCase();
  if (lowered.includes(`/${skill.name.toLowerCase()}`)) return true;
  return draft.includes(`(skill:${skill.id})`);
}

/** A message-start slash line belongs to the `/` face. */
function isSlashLine(draft: string): boolean {
  return draft.trimStart().startsWith('/');
}

/** First matching suggestion, or null when nothing should be shown. */
export function suggestSkill(
  draft: string,
  skills: readonly SuggestSkillEntry[],
): SkillSuggestion | null {
  if (draft.trim() === '') return null;
  if (isSlashLine(draft)) return null;
  if (skills.length === 0) return null;
  const loweredDraft = draft.toLowerCase();
  for (const intent of TRIGGER_INTENTS) {
    if (!intent.triggers.some((t) => loweredDraft.includes(t.toLowerCase()))) continue;
    const hit = skills.find(
      (s) =>
        !alreadyReferenced(draft, s) &&
        intent.skillKeywords.some(
          (k) =>
            s.name.toLowerCase().includes(k.toLowerCase()) ||
            (s.description ?? '').toLowerCase().includes(k.toLowerCase()),
        ),
    );
    if (hit !== undefined) return { skillId: hit.id, skillName: hit.name, intentId: intent.id };
  }
  return null;
}
