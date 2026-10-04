// Skill auto-suggest matcher (issue #823) — tests first per repo discipline.
// Pins the failure-mode list decided before implementation:
//   F1 each first-batch intent fires on its trigger phrasing (ZH + EN)
//   F2 no trigger phrasing -> null (chatter never suggests)
//   F3 team has no matching skill -> null (never invents a candidate;
//       the vocab is useSkills-only, no side table)
//   F4 skill already referenced in the draft -> null (no duplicate nudge)
//   F5 empty / whitespace draft -> null
//   F6 case-insensitive on both faces (draft + skill name/description)
//   F7 multi-intent draft follows table order (first intent wins)
//   F8 slash-command line (`/…` at message start) -> null (the `/` face
//       owns that line; no key/intent clash by construction)
import { describe, expect, test } from 'vitest';
import { suggestSkill } from '@pacman/shared';

const SKILLS = [
  { id: 's-remind', name: 'remind', description: 'schedule reminders and cron notifications' },
  { id: 's-trans', name: 'translate', description: '翻译文本' },
  { id: 's-sum', name: 'summarize', description: '总结长文档' },
  { id: 's-review', name: 'code-review', description: '代码审查' },
];

describe('suggestSkill first-batch intents', () => {
  test('F1 reminder fires on time expressions', () => {
    expect(suggestSkill('明早 9 点提醒我开会', SKILLS)?.skillId).toBe('s-remind');
    expect(suggestSkill('remind me tomorrow at 9am', SKILLS)?.skillId).toBe('s-remind');
  });
  test('F1 translate fires', () => {
    expect(suggestSkill('把这段翻译成英文', SKILLS)?.skillId).toBe('s-trans');
    expect(suggestSkill('translate this paragraph', SKILLS)?.skillId).toBe('s-trans');
  });
  test('F1 summarize fires', () => {
    expect(suggestSkill('帮我总结一下这篇文档', SKILLS)?.skillId).toBe('s-sum');
    expect(suggestSkill('summarize this doc', SKILLS)?.skillId).toBe('s-sum');
  });
  test('F1 review fires', () => {
    expect(suggestSkill('帮我 review 一下这段代码', SKILLS)?.skillId).toBe('s-review');
    expect(suggestSkill('做一次代码审查', SKILLS)?.skillId).toBe('s-review');
  });
  test('F2 chatter without triggers stays silent', () => {
    expect(suggestSkill('今天天气不错', SKILLS)).toBeNull();
    expect(suggestSkill('hello world', SKILLS)).toBeNull();
  });
  test('F3 no matching skill in vocab stays silent', () => {
    expect(suggestSkill('明早 9 点提醒我开会', [])).toBeNull();
    expect(
      suggestSkill('明早 9 点提醒我开会', [{ id: 'x', name: 'translate', description: '翻译' }]),
    ).toBeNull();
  });
  test('F4 already-referenced skill is not re-suggested', () => {
    expect(suggestSkill('/remind 明早 9 点提醒我', SKILLS)).toBeNull();
    expect(suggestSkill('明早提醒我 [remind](skill:s-remind)', SKILLS)).toBeNull();
  });
  test('F5 empty draft stays silent', () => {
    expect(suggestSkill('', SKILLS)).toBeNull();
    expect(suggestSkill('   ', SKILLS)).toBeNull();
  });
  test('F6 matching is case-insensitive', () => {
    expect(suggestSkill('REMIND me tomorrow', SKILLS)?.skillId).toBe('s-remind');
    expect(
      suggestSkill('明早提醒我', [{ id: 'r', name: 'Remind', description: 'SCHEDULE alerts' }])
        ?.skillId,
    ).toBe('r');
  });
  test('F7 first table intent wins on multi-intent drafts', () => {
    expect(suggestSkill('明早提醒我，顺便翻译成英文', SKILLS)?.skillId).toBe('s-remind');
  });
  test('F8 slash-command line belongs to the slash face', () => {
    expect(suggestSkill('/remind', SKILLS)).toBeNull();
    expect(suggestSkill('  /translate hello', SKILLS)).toBeNull();
  });
});
