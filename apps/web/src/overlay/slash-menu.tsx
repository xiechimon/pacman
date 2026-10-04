// Slash menu + command help skins (issue #731).
//
// SlashMenu: the `/` listbox. Same combobox contract as MentionInline
// (#728): the textarea keeps focus for the whole open window — rows are
// non-focusable (tabIndex -1 + mousedown preventDefault) and the highlight
// is exposed through aria-activedescendant. Rows render in caller-given
// sections (builtins first, then skills); a zero total renders the empty
// state (rule 51 isomorph).
//
// SlashHelp: the `/help` panel. A read-only FloatingShell listing the
// currently available builtins with their descriptions — the only builtin
// that needs its own surface (proposal §2).

import { Fragment, type Ref, useEffect } from 'react';
import { FLOATING_POP_ANIM, FloatingShell } from '../components/ui/floating-shell.js';
import { useI18n } from '../i18n/provider.js';
import { ClickCatcher } from '../overlays/dismiss.js';
import type { SlashRow } from './slash-commands.js';
import './slash-menu.css';

export interface SlashMenuSection {
  title: string;
  rows: SlashRow[];
}

export interface SlashMenuProps {
  open: boolean;
  sections: SlashMenuSection[];
  /** Start offset of the detected `/` token (data-caret debug anchor). */
  caret: number | null;
  /** Query text after `/` — only the empty-state copy consumes it. */
  query: string;
  /** Global highlight index across sections; null = none highlighted. */
  highlight: number | null;
  onHover: (index: number) => void;
  onPick: (row: SlashRow) => void;
  listboxRef: Ref<HTMLDivElement>;
  listboxId: string;
}

export function SlashMenu({
  open,
  sections,
  caret,
  query,
  highlight,
  onHover,
  onPick,
  listboxRef,
  listboxId,
}: SlashMenuProps) {
  const { t } = useI18n();
  const total = sections.reduce((n, s) => n + s.rows.length, 0);
  useEffect(() => {
    if (!open || highlight == null) return;
    document.getElementById(`${listboxId}-opt-${highlight}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight, listboxId]);
  if (!open) return null;
  let offset = 0;
  return (
    <div
      ref={listboxRef}
      id={listboxId}
      className="slash-menu duration-100 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
      role="listbox"
      aria-label="Commands"
      data-caret={caret ?? ''}
    >
      {total === 0 ? (
        <div className="slash-menu-empty">{t('没有匹配"/{query}"的命令', { query })}</div>
      ) : (
        sections.map((section) => {
          const base = offset;
          offset += section.rows.length;
          return (
            <Fragment key={section.title}>
              <div className="slash-menu-head" aria-hidden="true">
                {section.title}
              </div>
              {section.rows.map((row, i) => {
                const index = base + i;
                return (
                  <button
                    key={`${section.title}-${row.name}`}
                    id={`${listboxId}-opt-${index}`}
                    type="button"
                    tabIndex={-1}
                    role="option"
                    aria-selected={index === highlight}
                    className={`slash-menu-row${index === highlight ? ' slash-menu-row--active' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => onHover(index)}
                    onClick={() => onPick(row)}
                  >
                    <span className="slash-menu-name">/{row.name}</span>
                    <span className="slash-menu-desc">
                      {row.descKey != null ? t(row.descKey) : (row.description ?? '')}
                    </span>
                  </button>
                );
              })}
            </Fragment>
          );
        })
      )}
    </div>
  );
}

export interface SlashHelpProps {
  open: boolean;
  onClose: () => void;
  /** Currently available builtins (same rows as the menu). */
  commands: SlashRow[];
  skillCount: number;
}

export function SlashHelp({ open, onClose, commands, skillCount }: SlashHelpProps) {
  const { t } = useI18n();
  return (
    <FloatingShell open={open} onClose={onClose} className="slash-help-shell">
      <ClickCatcher onClose={onClose} />
      <div
        className={`slash-help ${FLOATING_POP_ANIM}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('命令说明')}
      >
        <div className="slash-help-title">{t('命令说明')}</div>
        <div className="slash-help-list">
          {commands.map((row) => (
            <div key={row.name} className="slash-help-row">
              <span className="slash-menu-name">/{row.name}</span>
              <span className="slash-menu-desc">
                {row.descKey != null ? t(row.descKey) : (row.description ?? '')}
              </span>
            </div>
          ))}
        </div>
        <div className="slash-help-foot">
          {t('团队技能来自技能页面（共 {count} 个）', { count: skillCount })}
        </div>
      </div>
    </FloatingShell>
  );
}
