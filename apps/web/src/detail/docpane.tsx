// Doc pane (issue #56, extended in #57 for the 变更 surface, in #67 for
// the 方案▾ type dropdown and in #75 for the r8 plan-version surfaces):
// plan mode keeps the 方案▾ / vN▾ header over the plan markdown (or the
// centered 暂无方案 placeholder in planning, r7 16). Changes mode
// (review/done/failed) renders the diff header 变更▾ v1▾ · N 个文件改动
// +N with the 全部展开/全部收起 toggle (r7 §3.6), one file row per changed
// file (chevron + name + 👁 + right-aligned +N), the unified-diff hunks
// when expanded (r7 27b) and the centered 暂无可显示的变更 placeholder
// when there is nothing to show (r7 38). #75 adds the version dropdown
// under the version chip (r8 63/70: version rows + 与其他版本对比… +
// 回到与 base 对比), the compare submenu (r8 64: 上一版本 alone) and the
// plan-version diff surface (r8 65–72: range chip `v1 → v2`, `+A −B`
// stats, del/add/marker rows).

import { useState } from 'react';
import { relativeTime } from '../board/rel-time.js';
import type {
  ChangesContent,
  DiffFile,
  DocBlock,
  PlanDiffContent,
  PlanVersion,
} from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileTab,
  FileText,
  Restore,
  UnfoldVertical,
} from '../icons/index.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from '../overlays/dismiss.js';
import { PlanDropdown } from '../overlays/plan-dropdown.js';
import { Segments } from './segments.js';

interface DocPaneProps {
  /** plan: 方案 header + markdown; changes: diff surface (review/done/
   *  failed); diff: plan-version unified diff (r8 65–72). */
  mode: 'plan' | 'changes' | 'diff';
  doc: DocBlock[] | undefined;
  changes: ChangesContent | undefined;
  /** Fixture instant the relative version ages are measured against. */
  now: number;
  /** Scenario-frozen initial open state of the 方案▾ dropdown (#67). */
  planDropdownOpen?: boolean;
  /** Version dropdown rows, newest first (r8 63/70). */
  planVersions?: PlanVersion[];
  /** Open menu on the version chip / range chip (r8 63/64). */
  versionMenu?: 'versions' | 'compare';
  onVersionMenu?: (menu: 'versions' | 'compare' | undefined) => void;
  /** 上一版本 picked in the compare submenu (r8 64 → 71). */
  onCompare?: () => void;
  /** 回到与 base 对比 picked (r8 70): drops the diff surface. */
  onBase?: () => void;
  /** Plan-version diff content (mode 'diff'). */
  planDiff?: PlanDiffContent;
  onToggleExpand?: () => void;
}

function DiffFileBlock({ file, expanded }: { file: DiffFile; expanded: boolean }) {
  const { t } = useI18n();
  return (
    <div className="diff-file">
      <div className="doc-file-row">
        {expanded ? (
          <ChevronDown width={10} height={10} />
        ) : (
          <ChevronRight width={10} height={10} />
        )}
        <FileText width={14} height={14} />
        {file.path}
        <span className="doc-file-eye">
          <Eye width={14} height={14} />
        </span>
        <span className="doc-file-add">
          +{file.added}
          {file.removed != null && file.removed > 0 && (
            <span className="doc-file-del"> −{file.removed}</span>
          )}
        </span>
      </div>
      {expanded && (
        <div className="diff-body">
          {file.hunks.map((hunk) => (
            <div key={hunk.header} className="diff-hunk">
              <div className="diff-hunk-head">{hunk.header}</div>
              {hunk.lines.map((line, i) => (
                // fixture order is stable; lines carry no ids
                <div key={i} className={`diff-line diff-line--${line.kind}`}>
                  <span className="diff-no diff-no--old">{line.oldNo ?? ''}</span>
                  <span className="diff-no diff-no--new">{line.newNo ?? ''}</span>
                  <span className="diff-mark">
                    {line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ''}
                  </span>
                  <span className="diff-text">{line.text}</span>
                </div>
              ))}
            </div>
          ))}
          <button type="button" className="diff-expand">
            <UnfoldVertical width={12} height={12} />
            {t('显示完整文件')}
          </button>
        </div>
      )}
    </div>
  );
}

/** The floating menu under the version chip / range chip: the version
 *  list (current row bold, restore glyph right, ages computed from the
 *  fixture instant), then 与其他版本对比… (right label = the open diff's
 *  `from`, r8 70) and — only while a diff is open — 回到与 base 对比. */
function VersionMenu({
  versions,
  menu,
  now,
  diffOpen,
  diffFrom,
  onMenu,
  onCompare,
  onBase,
}: {
  versions: PlanVersion[];
  menu: 'versions' | 'compare';
  now: number;
  diffOpen: boolean;
  diffFrom?: string;
  onMenu: (menu: 'versions' | 'compare' | undefined) => void;
  onCompare: () => void;
  onBase: () => void;
}) {
  const { t } = useI18n();
  if (menu === 'compare') {
    return (
      <div className="version-menu version-menu--sub">
        <button type="button" className="version-menu-row" onClick={onCompare}>
          {t('上一版本')}
        </button>
      </div>
    );
  }
  return (
    <div className="version-menu">
      {versions.map((row, i) => (
        <button
          type="button"
          key={row.v}
          className={`version-menu-row${i === 0 ? ' version-menu-row--current' : ''}`}
          onClick={() => onMenu(undefined)}
        >
          <span>
            {row.v} · {relativeTime(row.at, now, t)}
          </span>
          <Restore width={13} height={13} />
        </button>
      ))}
      <button type="button" className="version-menu-row" onClick={() => onMenu('compare')}>
        <span>{t('与其他版本对比…')}</span>
        {diffOpen && diffFrom != null && <span className="version-menu-label">{diffFrom}</span>}
      </button>
      {diffOpen && (
        <button type="button" className="version-menu-row" onClick={onBase}>
          <span>{t('回到与 base 对比')}</span>
        </button>
      )}
    </div>
  );
}

/** Version chip + its menu anchor, shared by the plan-mode select and
 *  the diff-mode range chip (r8 63/70 anchor the panel to the chip's
 *  right edge). */
function VersionControl({
  range,
  label,
  planVersions,
  versionMenu,
  now,
  onVersionMenu,
  onCompare,
  onBase,
}: {
  /** Range chip (`v1 → v2`) when a diff is open; plain select otherwise. */
  range?: { from: string; to: string };
  label?: string;
  planVersions?: PlanVersion[];
  versionMenu?: 'versions' | 'compare';
  now: number;
  onVersionMenu?: (menu: 'versions' | 'compare' | undefined) => void;
  onCompare?: () => void;
  onBase?: () => void;
}) {
  const toggle = () => onVersionMenu?.(versionMenu === 'versions' ? undefined : 'versions');
  return (
    <span className="doc-range-wrap">
      {range != null ? (
        <button type="button" className="doc-range-chip" onClick={toggle}>
          {range.from} → {range.to}
          <ChevronDown width={12} height={12} />
        </button>
      ) : (
        <button type="button" className="doc-pane-select" onClick={toggle}>
          {label}
          <ChevronDown width={12} height={12} />
        </button>
      )}
      {versionMenu != null && onVersionMenu != null && planVersions != null && (
        <VersionMenu
          versions={planVersions}
          menu={versionMenu}
          now={now}
          diffOpen={range != null}
          diffFrom={range?.from}
          onMenu={onVersionMenu}
          onCompare={() => onCompare?.()}
          onBase={() => onBase?.()}
        />
      )}
    </span>
  );
}

export function DocPane({
  mode,
  doc,
  changes,
  now,
  planDropdownOpen,
  planVersions,
  versionMenu,
  onVersionMenu,
  onCompare,
  onBase,
  planDiff,
  onToggleExpand,
}: DocPaneProps) {
  const { t } = useI18n();
  const [typeOpen, setTypeOpen] = useState(planDropdownOpen === true);
  useEscapeClose(typeOpen, () => setTypeOpen(false));
  if (mode === 'changes' || mode === 'diff') {
    const files = mode === 'diff' ? (planDiff?.files ?? []) : (changes?.files ?? []);
    const expanded = mode === 'diff' ? (planDiff?.expanded ?? false) : (changes?.expanded ?? false);
    const fileCount = files.length;
    const added = files.reduce((sum, f) => sum + f.added, 0);
    const removed = files.reduce((sum, f) => sum + (f.removed ?? 0), 0);
    return (
      <section className="doc-pane">
        {mode === 'changes' && changes == null ? (
          <div className="doc-empty doc-empty--full">{t('暂无可显示的变更')}</div>
        ) : (
          <>
            <header className="doc-pane-head">
              <FileTab width={14} height={14} />
              {/* 变更▾/方案▾ 型选钮（#149 接线）：#67 文档类型选同款族律
                  ——单选项 listbox（当前类型 ✓），非确认入口；live 面变更
                  pane 数据本就是真 diff（builds/{id}/changes，#83）。 */}
              <span className="doc-select-wrap">
                <button
                  type="button"
                  className="doc-pane-select"
                  aria-expanded={typeOpen}
                  onClick={() => setTypeOpen((value) => !value)}
                >
                  {mode === 'diff' ? t('方案') : t('变更')}
                  <ChevronDown width={12} height={12} />
                </button>
                <OverlayMount open={typeOpen}>
                  <ClickCatcher onClose={() => setTypeOpen(false)} />
                  <PlanDropdown current={mode === 'diff' ? '方案' : '变更'} />
                </OverlayMount>
              </span>
              {mode === 'diff' && planDiff != null ? (
                <VersionControl
                  range={{ from: planDiff.from, to: planDiff.to }}
                  planVersions={planVersions}
                  versionMenu={versionMenu}
                  now={now}
                  onVersionMenu={onVersionMenu}
                  onCompare={onCompare}
                  onBase={onBase}
                />
              ) : (
                <VersionControl
                  label={planVersions?.[0]?.v ?? 'v1'}
                  planVersions={planVersions}
                  versionMenu={versionMenu}
                  now={now}
                  onVersionMenu={onVersionMenu}
                  onCompare={onCompare}
                  onBase={onBase}
                />
              )}
              <span className="doc-changes-stat">
                {t('· {n} 个文件改动', { n: fileCount })}{' '}
                <span className="doc-changes-add">+{added}</span>
                {removed > 0 && <span className="doc-changes-del"> −{removed}</span>}
              </span>
              <button type="button" className="doc-expand-all" onClick={onToggleExpand}>
                {expanded ? t('全部收起') : t('全部展开')}
              </button>
            </header>
            {files.map((file) => (
              <DiffFileBlock key={file.path} file={file} expanded={expanded} />
            ))}
          </>
        )}
      </section>
    );
  }

  return (
    <section className="doc-pane">
      {doc != null && (
        <header className="doc-pane-head">
          <FileTab width={14} height={14} />
          <span className="doc-select-wrap">
            <button
              type="button"
              className="doc-pane-select"
              aria-expanded={typeOpen}
              onClick={() => setTypeOpen((value) => !value)}
            >
              {t('方案')}
              <ChevronDown width={12} height={12} />
            </button>
            <OverlayMount open={typeOpen}>
              <ClickCatcher onClose={() => setTypeOpen(false)} />
              <PlanDropdown />
            </OverlayMount>
          </span>
          <VersionControl
            label={planVersions?.[0]?.v ?? 'v1'}
            planVersions={planVersions}
            versionMenu={versionMenu}
            now={now}
            onVersionMenu={onVersionMenu}
            onCompare={onCompare}
            onBase={onBase}
          />
        </header>
      )}
      <div className="doc-pane-body">
        {doc == null ? (
          <div className="doc-empty">{t('暂无方案')}</div>
        ) : (
          doc.map((block, i) => (
            <p
              // fixture order is stable; blocks carry no ids
              key={i}
              className={`doc-block doc-block--${block.kind}`}
            >
              {block.kind === 'bullet' ? '• ' : ''}
              <Segments segments={block.segments} codeClassName="doc-code" />
            </p>
          ))
        )}
      </div>
    </section>
  );
}
