// 方案▾/变更▾ document-type dropdown (issue #67, r7 20 / r5b 05f; #149
// generalized to the changes/diff header select; #366 generalized again
// into the detail right-pane view picker): 218-wide panel right-aligned
// under the pane-head type button. The first row is the doc surface's
// phase-derived type (方案|变更 — re-selecting it just stays on the doc
// view), then the three static pane sections that replaced the former
// head-icon overlay dialogs (分支与 PR / Token 用量 / 运行历史). Row click
// = pick the view and close — the lang-dropdown select-and-close law
// (#306 校准: a rendered option row must act, not just check). Surfaces
// without build payload data list the doc row alone (no dead rows).

import { useState } from 'react';
import type { PaneView } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronDown } from '../icons/index.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from './dismiss.js';
import './overlays.css';

/** Row/button copy — zh dict keys, rendered through t(). */
export type PaneRowLabel = '方案' | '变更' | '分支与 PR' | 'Token 用量' | '运行历史';

/** The doc surface's phase-derived type word (the listbox's first row). */
export type DocTypeLabel = '方案' | '变更';

const SECTION_ROWS: Array<{ view: PaneView; label: PaneRowLabel }> = [
  { view: 'branch', label: '分支与 PR' },
  { view: 'token', label: 'Token 用量' },
  { view: 'history', label: '运行历史' },
];

/** The listbox panel itself (no open-state management). */
export function PlanDropdown({
  docLabel,
  view,
  sections = true,
  onSelect,
}: {
  /** Doc row label — the phase-derived document type (方案 or 变更). */
  docLabel: DocTypeLabel;
  /** Active pane view; its row carries the ✓. */
  view: PaneView;
  /** false = no build payload (fresh/legacy surfaces): the doc row alone. */
  sections?: boolean;
  /** Row click: pick the view — the owner closes the dropdown (same
   *  contract as lang-dropdown rows). */
  onSelect: (view: PaneView) => void;
}) {
  const { t } = useI18n();
  const rows: Array<{ view: PaneView; label: PaneRowLabel }> = [
    { view: 'doc', label: docLabel },
    ...(sections ? SECTION_ROWS : []),
  ];
  return (
    <div className="plan-dropdown" role="listbox" aria-label={t('面板视图')}>
      {rows.map((row) => (
        <button
          key={row.view}
          type="button"
          className="plan-dropdown-row"
          role="option"
          aria-selected={row.view === view}
          onClick={() => onSelect(row.view)}
        >
          {t(row.label)}
          {row.view === view && (
            <span className="plan-dropdown-check">
              <Check width={14} height={14} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Type-select button + dropdown, shared by the doc-pane head and the three
 *  section heads (#366): OverlayMount / transparent ClickCatcher / Escape
 *  close ride the #67 anchored-overlay family law. The button label is the
 *  active view's own word. */
export function PaneTypeSelect({
  view,
  docLabel,
  sections,
  onView,
  initiallyOpen,
}: {
  view: PaneView;
  docLabel: DocTypeLabel;
  sections?: boolean;
  onView: (view: PaneView) => void;
  /** Scenario-frozen initial open state (#67, r7 20). */
  initiallyOpen?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(initiallyOpen === true);
  useEscapeClose(open, () => setOpen(false));
  const label: PaneRowLabel =
    view === 'doc'
      ? docLabel
      : (SECTION_ROWS.find((row) => row.view === view)?.label ?? '分支与 PR');
  return (
    <span className="doc-select-wrap">
      <button
        type="button"
        className="doc-pane-select"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t(label)}
        <ChevronDown width={12} height={12} />
      </button>
      <OverlayMount open={open}>
        <ClickCatcher onClose={() => setOpen(false)} />
        <PlanDropdown
          docLabel={docLabel}
          view={view}
          sections={sections}
          onSelect={(next) => {
            setOpen(false);
            onView(next);
          }}
        />
      </OverlayMount>
    </span>
  );
}
