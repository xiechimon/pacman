// Mention popover (issue #311, r9 §2.2/§3.2): a centered 400-wide panel
// that opens over a scrim. Top layer = five category rows (任务 / 技能 /
// Agents / 项目 / 机器) with counts; clicking a row drills in to a
// second layer with a search box and the row list. Selection is
// multi-select cumulative (no checkbox glyph per r9 §3.2 — the
// `插入 (N)` footer count is the only indicator); the footer offers
// 取消 / 插入 (N) with the count driving button state.
//
// Wire surface = onInsert(mentions[]). The caller maps the picker
// tokens into the host textarea / spec textarea via
// insertMentionText — the picker only knows about the structured
// MentionToken shape; it never touches the editor.
//
// Live / fixture dual-track: the picker is data-source agnostic. The
// caller (composer / new-task-dialog) decides whether to feed it from
// the live REST hooks or the fixture set and passes the resolved
// MentionGroups in. This mirrors search-panel's `server` prop
// pattern (#286): fixture mode keeps DOM-stable; live mode wires the
// real entity endpoints.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/provider.js';
import { ChevronLeft, FileCheck, Layers, Puzzle, Server, Users, X } from '../icons/index.js';
import { ClickCatcher, OverlayMount } from '../overlays/dismiss.js';
import type { MentionKind, MentionToken } from './mention-token.js';
import './mention-picker.css';

/** One entity row inside a drilled-in category. The picker renders the
 *  `label` chip verbatim; for todo rows the label carries the seq
 *  prefix (`#1` etc.) built by the caller. `subtitle` is the
 *  secondary line (project name, machine id tail, etc.). */
export interface MentionGroupEntry {
  id: string;
  label: string;
  subtitle?: string;
  /** Todo seq (`#1`) — only set when `kind === 'todo'`. */
  seq?: number;
}

export interface MentionGroups {
  todo: MentionGroupEntry[];
  skill: MentionGroupEntry[];
  agent: MentionGroupEntry[];
  project: MentionGroupEntry[];
  machine: MentionGroupEntry[];
}

interface MentionPickerProps {
  /** #73 retained-mount open flag — exit fade outlives the close. */
  open: boolean;
  onClose: () => void;
  /** Caller receives the structured mention list (already filtered for
   *  the categories it selected). The picker closes after this fires. */
  onInsert: (tokens: MentionToken[]) => void;
  groups: MentionGroups;
}

type Layer = 'top' | MentionKind;

/** Category header config (label + icon). Order is the panel order
 *  (r9 §2.2 first-layer scan). */
const CATEGORIES: { kind: MentionKind; Icon: typeof FileCheck; iconClass: string }[] = [
  { kind: 'todo', Icon: FileCheck, iconClass: 'mention-icon--todo' },
  { kind: 'skill', Icon: Puzzle, iconClass: 'mention-icon--skill' },
  { kind: 'agent', Icon: Users, iconClass: 'mention-icon--agent' },
  { kind: 'project', Icon: Layers, iconClass: 'mention-icon--project' },
  { kind: 'machine', Icon: Server, iconClass: 'mention-icon--machine' },
];

/** r9 §2.2 first layer uses a 28px icon glyph + label + count chip on
 *  the right. Each row is 44 tall, pitch 45 — implemented as 44 + 1
 *  divider to match the existing overlay chip-row family. */
function TopRow({
  kind,
  Icon,
  iconClass,
  count,
  onClick,
}: {
  kind: MentionKind;
  Icon: typeof FileCheck;
  iconClass: string;
  count: number;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="mention-row mention-row--top"
      onClick={onClick}
      // Empty categories stay focusable so ⌘K-style screen-reader
      // navigation works — the click is a no-op when count is 0.
      disabled={count === 0}
      aria-label={`${labelFor(t, kind)} (${count})`}
    >
      <span className={`mention-row-icon ${iconClass}`}>
        <Icon width={16} height={16} />
      </span>
      <span className="mention-row-label">{labelFor(t, kind)}</span>
      <span className="mention-row-count">{count}</span>
    </button>
  );
}

/** Resolved display label for a category. i18n keys are the existing
 *  chrome strings from en.ts (任务 / 技能 / Agents / 项目 / 机器); the
 *  picker uses them verbatim so the en fallback carries the same
 *  vocabulary as the rest of the app. */
function labelFor(t: ReturnType<typeof useI18n>['t'], kind: MentionKind): string {
  switch (kind) {
    case 'todo':
      return t('任务');
    case 'skill':
      return t('技能');
    case 'agent':
      return 'Agents';
    case 'project':
      return t('项目');
    case 'machine':
      return t('机器');
  }
}

export function MentionPicker({ open, onClose, onInsert, groups }: MentionPickerProps) {
  const { t } = useI18n();
  const [layer, setLayer] = useState<Layer>('top');
  const [query, setQuery] = useState('');
  // Selected ids per kind — the picker keeps them while the user
  // toggles rows inside the drilled layer; switching kind clears the
  // search query but keeps the accumulated selection for the Insert
  // count.
  const [selected, setSelected] = useState<Record<MentionKind, Set<string>>>({
    todo: new Set(),
    skill: new Set(),
    agent: new Set(),
    project: new Set(),
    machine: new Set(),
  });

  // Reset every time the popover opens — closing with no insert
  // should not leak the previous selection into the next open.
  useEffect(() => {
    if (!open) return;
    setLayer('top');
    setQuery('');
    setSelected({
      todo: new Set(),
      skill: new Set(),
      agent: new Set(),
      project: new Set(),
      machine: new Set(),
    });
  }, [open]);

  // Esc closes the picker (caller decides whether the outer dialog
  // also closes via its own useEscClose layer, identical to the
  // project popover in new-task-dialog).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const allSelected = useMemo(() => {
    const list: { kind: MentionKind; id: string; label: string; seq?: number }[] = [];
    (Object.keys(selected) as MentionKind[]).forEach((kind) => {
      const entries = groups[kind];
      const ids = selected[kind];
      ids.forEach((id) => {
        const found = entries.find((e) => e.id === id);
        if (!found) return;
        list.push({ kind, id, label: found.label, seq: found.seq });
      });
    });
    return list;
  }, [selected, groups]);

  const counts: Record<MentionKind, number> = {
    todo: groups.todo.length,
    skill: groups.skill.length,
    agent: groups.agent.length,
    project: groups.project.length,
    machine: groups.machine.length,
  };

  const drilledKind: Exclude<MentionKind, 'todo'> | 'todo' | null = layer === 'top' ? null : layer;

  const drilledEntries = drilledKind === null ? [] : groups[drilledKind];
  const drilledQuery = query.trim().toLowerCase();
  const filteredEntries =
    drilledKind === null
      ? []
      : drilledQuery === ''
        ? drilledEntries
        : drilledEntries.filter((e) => e.label.toLowerCase().includes(drilledQuery));

  const toggle = (kind: MentionKind, id: string) => {
    setSelected((prev) => {
      const next = { ...prev, [kind]: new Set(prev[kind]) };
      if (next[kind].has(id)) next[kind].delete(id);
      else next[kind].add(id);
      return next;
    });
  };

  const insert = () => {
    const tokens: MentionToken[] = allSelected.map((s) => ({
      kind: s.kind,
      label: s.label,
      id: s.id,
      ...(s.seq != null ? { seq: s.seq } : {}),
    }));
    if (tokens.length === 0) return;
    onInsert(tokens);
  };

  return (
    <OverlayMount open={open} exitMs={160}>
      <ClickCatcher onClose={onClose} />
      <div
        className="mention-picker anim-pop"
        role="dialog"
        aria-modal="true"
        aria-label={t('提及')}
      >
        <div className="mention-picker-head">
          {layer !== 'top' ? (
            <button
              type="button"
              className="mention-picker-back"
              aria-label={t('返回')}
              onClick={() => setLayer('top')}
            >
              <ChevronLeft width={14} height={14} />
            </button>
          ) : null}
          <div className="mention-picker-title">
            {layer === 'top' ? t('提及') : `${labelFor(t, layer)} · ${counts[layer]}`}
          </div>
          <button
            type="button"
            className="mention-picker-close"
            aria-label={t('关闭')}
            onClick={onClose}
          >
            <X width={14} height={14} />
          </button>
        </div>
        {layer === 'top' ? (
          <div className="mention-picker-list">
            {CATEGORIES.map(({ kind, Icon, iconClass }) => (
              <TopRow
                key={kind}
                kind={kind}
                Icon={Icon}
                iconClass={iconClass}
                count={counts[kind]}
                onClick={() => setLayer(kind)}
              />
            ))}
          </div>
        ) : (
          <>
            <div className="mention-picker-search">
              <input
                type="text"
                className="mention-picker-search-input"
                placeholder={t('搜索…')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="mention-picker-list">
              {filteredEntries.length === 0 ? (
                <div className="mention-picker-empty">
                  {drilledQuery === ''
                    ? t('没有可引用的对象')
                    : t('没有与"{query}"匹配的结果', { query: drilledQuery })}
                </div>
              ) : (
                filteredEntries.map((entry) => {
                  const isSelected = selected[layer].has(entry.id);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={`mention-row mention-row--entry${isSelected ? ' mention-row--selected' : ''}`}
                      onClick={() => toggle(layer, entry.id)}
                    >
                      <span className="mention-row-main">
                        <span className="mention-row-title">{entry.label}</span>
                        {entry.subtitle != null && (
                          <span className="mention-row-sub">{entry.subtitle}</span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
        <div className="mention-picker-foot">
          <button type="button" className="mention-picker-cancel" onClick={onClose}>
            {t('取消')}
          </button>
          <button
            type="button"
            className="mention-picker-insert"
            disabled={allSelected.length === 0}
            onClick={insert}
          >
            {t('插入 ({count})', { count: allSelected.length })}
          </button>
        </div>
      </div>
    </OverlayMount>
  );
}

/** Inline agents-only listbox for the composer's `@` autocomplete
 *  (r9 §3.2: listbox anchored above the composer, only agents,
 *  click inserts the agent mention token; Enter is left for the
 *  textarea to handle — the @ picker closes on selection without
 *  triggering send). */
export interface MentionInlineProps {
  open: boolean;
  agents: { id: string; label: string; subtitle?: string }[];
  /** Caret offset inside the textarea value where the `@` token
   *  started — used to highlight the matching prefix and to keep
   *  the inline listbox from re-opening on the same keystroke. */
  caret: number | null;
  onPick: (entry: { id: string; label: string }) => void;
  onClose: () => void;
}

export function MentionInline({ open, agents, caret, onPick, onClose }: MentionInlineProps) {
  const inputRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  // Esc closes the inline listbox without disturbing the composer
  // textarea caret.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="mention-inline anim-pop"
      role="listbox"
      aria-label="Agents"
      data-caret={caret ?? ''}
    >
      {agents.length === 0 ? (
        <div className="mention-inline-empty">没有可用的 Agent</div>
      ) : (
        agents.map((agent) => (
          <button
            key={agent.id}
            ref={inputRef}
            type="button"
            className="mention-inline-row"
            role="option"
            onClick={() => onPick(agent)}
          >
            <span className="mention-inline-avatar">{agent.label.charAt(0).toLowerCase()}</span>
            <span className="mention-inline-main">
              <span className="mention-inline-title">{agent.label}</span>
              {agent.subtitle != null && (
                <span className="mention-inline-sub">{agent.subtitle}</span>
              )}
            </span>
          </button>
        ))
      )}
    </div>
  );
}
