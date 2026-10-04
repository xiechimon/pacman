// Slash command completion (issue #731, canon = #727 §2).
//
// Shares the trigger/keyboard/highlight machinery with the `@` family
// (overlay/completion.ts); only the trigger spec and the matcher differ:
// `@` = fuzzy subsequence (rule 15), `/` = separator-word prefix
// (rules 48-49). The builtin vocabulary (D1) is six client-real commands —
// every entry is either a live composer action or opens the help panel,
// never a placeholder. Team skills arrive as data (insert kind).

import { COMPLETION_CAP, type CompletionRange, type CompletionTriggerSpec } from './completion.js';

/** `/` trigger spec. Boundary = row head / whitespace / CJK punctuation
 *  (rules 39-40, same class as `@`). Token class excludes whitespace AND
 *  `/`: a second slash (the `/tmp/notes.md` shape, rule 41) ends the token
 *  and closes the menu with the text left literal. `@` is excluded too so
 *  the two detectors can never dual-open (S3). */
export const SLASH_COMPLETION_SPEC: CompletionTriggerSpec = {
  trigger: '/',
  tokenClass: '\\p{L}\\p{N}\\p{M}_.()[\\]~:-',
};

/** Word-prefix matcher for the `/` family (rules 48-49): the query matches
 *  when it is a prefix of any separator-delimited word in the name, or a
 *  prefix of the name with separators removed (`adddir` ~ `add-dir`).
 *  Always case-insensitive. Deliberately NOT the `@` subsequence matcher —
 *  `/sl` must not hit `spell-check` (the two families never mix).
 *  Empty query = no filtering, caller order, still capped. */
export function slashFilter<T>(
  query: string,
  items: readonly T[],
  labelOf: (item: T) => string,
  cap: number = COMPLETION_CAP,
): T[] {
  if (query === '') return items.slice(0, cap);
  const q = query.toLowerCase();
  return items
    .filter((item) => {
      const words = labelOf(item).split(/[:_-]/);
      if (words.some((w) => w.toLowerCase().startsWith(q))) return true;
      return words.join('').toLowerCase().startsWith(q);
    })
    .slice(0, cap);
}

/** Registry entry kind. `insert` rows land text in the draft (skills);
 *  `execute` rows run a client action when accepted at message start
 *  (approved semantics: Enter on a highlighted no-arg command runs it). */
export type SlashRowKind = 'insert' | 'execute';

export type BuiltinSlashName = 'clear' | 'attach' | 'mention' | 'review' | 'stop' | 'help';

export interface BuiltinSlashDef {
  name: BuiltinSlashName;
  aliases: string[];
  /** i18n key for the row description (resolved by the skin). */
  descKey: string;
  kind: 'execute';
}

/** The six D1 builtins in menu order (frequency order, not alphabetical).
 *  `clear` carries the canon alias `new` (rule 48: `/new` highlights
 *  `/clear` through its alias). */
export const BUILTIN_SLASH_COMMANDS: BuiltinSlashDef[] = [
  { name: 'clear', aliases: ['new'], descKey: '清空输入', kind: 'execute' },
  { name: 'attach', aliases: [], descKey: '添加附件', kind: 'execute' },
  { name: 'mention', aliases: ['at'], descKey: '打开提及面板', kind: 'execute' },
  { name: 'review', aliases: [], descKey: '发起 AI 审核', kind: 'execute' },
  { name: 'stop', aliases: ['cancel'], descKey: '停止当前运行', kind: 'execute' },
  { name: 'help', aliases: [], descKey: '查看命令说明', kind: 'execute' },
];

/** Team-skill input (same projection the mention popover uses). */
export interface SkillEntry {
  id: string;
  name: string;
  description?: string;
}

/** Which conditional builtins may be listed (rule 47 isomorph: an
 *  unavailable command is omitted, never a dead row). `review`/`stop`
 *  derive from the same props as their toolbar buttons. */
export interface AvailableSlash {
  review: boolean;
  stop: boolean;
}

export interface SlashRow {
  name: string;
  kind: SlashRowKind;
  /** Builtin only: descKey + run dispatch name. */
  builtin?: BuiltinSlashName;
  descKey?: string;
  /** Skill only: entity id + optional server description. */
  skillId?: string;
  description?: string;
}

export interface SlashSection {
  section: 'builtin' | 'skill';
  rows: SlashRow[];
}

export interface BuildSlashSectionsOptions {
  query: string;
  available: AvailableSlash;
  skills: readonly SkillEntry[];
  cap?: number;
}

/** Partition rule (proposal §3): builtins first in registry order, then
 *  skills in roster order; a skill whose name collides with a builtin is
 *  hidden (builtin wins); the cap is shared across sections. Empty sections
 *  are omitted so a zero-total render means the empty state. */
export function buildSlashSections({
  query,
  available,
  skills,
  cap = COMPLETION_CAP,
}: BuildSlashSectionsOptions): SlashSection[] {
  const q = query.toLowerCase();
  const matches = (names: string[]): boolean => {
    if (q === '') return true;
    return names.some((n) => {
      const words = n.split(/[:_-]/);
      if (words.some((w) => w.toLowerCase().startsWith(q))) return true;
      return words.join('').toLowerCase().startsWith(q);
    });
  };
  const builtinNames = new Set(BUILTIN_SLASH_COMMANDS.map((c) => c.name.toLowerCase()));
  const builtinRows: SlashRow[] = [];
  for (const def of BUILTIN_SLASH_COMMANDS) {
    if (def.name === 'review' && !available.review) continue;
    if (def.name === 'stop' && !available.stop) continue;
    if (!matches([def.name, ...def.aliases])) continue;
    builtinRows.push({ name: def.name, kind: 'execute', builtin: def.name, descKey: def.descKey });
    if (builtinRows.length >= cap) break;
  }
  const skillRows: SlashRow[] = [];
  const room = cap - builtinRows.length;
  if (room > 0) {
    for (const skill of skills) {
      if (builtinNames.has(skill.name.toLowerCase())) continue;
      if (!matches([skill.name])) continue;
      skillRows.push({
        name: skill.name,
        kind: 'insert',
        skillId: skill.id,
        ...(skill.description != null ? { description: skill.description } : {}),
      });
      if (skillRows.length >= room) break;
    }
  }
  const sections: SlashSection[] = [];
  if (builtinRows.length > 0) sections.push({ section: 'builtin', rows: builtinRows });
  if (skillRows.length > 0) sections.push({ section: 'skill', rows: skillRows });
  return sections;
}

/** True when the token starts the message (leading whitespace allowed).
 *  Only there may an execute row run (rule 40: mid-prompt is insert-only). */
export function isMessageStart(value: string, rangeStart: number): boolean {
  return value.slice(0, rangeStart).trim() === '';
}

export type SlashAcceptVia = 'enter' | 'tab';
export type SlashAcceptAction = 'run' | 'insert-token' | 'insert-text';

/** Approved accept semantics (+ #731 AC49 refinement): message-start +
 *  Enter + execute = run; skill rows (prompt-type) ALWAYS insert their
 *  token — a mid-prompt literal `/name` would be a dead reference, and
 *  AC49 carries no message-start qualifier. Only execute rows degrade to
 *  literal `/name ` text off message-start (rule 40), and Tab never runs. */
export function resolveSlashAccept({
  kind,
  atStart,
  via,
}: {
  name: string;
  kind: SlashRowKind;
  atStart: boolean;
  via: SlashAcceptVia;
}): SlashAcceptAction {
  if (via === 'enter' && atStart && kind === 'execute') return 'run';
  if (kind === 'insert') return 'insert-token';
  return 'insert-text';
}

/** Replace the `/query` span with `/name` + trailing space (rule 60).
 *  Caret lands after the space so typing continues cleanly. */
export function insertSlashText(
  value: string,
  range: CompletionRange,
  name: string,
): { value: string; caret: number } {
  const piece = `/${name} `;
  const next = value.slice(0, range.start) + piece + value.slice(range.end);
  return { value: next, caret: range.start + piece.length };
}
