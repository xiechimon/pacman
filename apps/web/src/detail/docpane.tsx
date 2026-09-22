// Doc pane (issue #56, extended in #57 for the 变更 surface and in #75
// for the r8 plan-version surfaces): plan mode keeps the 方案▾ / vN▾
// header over the plan markdown (or the centered 暂无方案 placeholder in
// planning, r7 16). Changes mode (review/done/failed) renders the diff
// header 变更▾ v1▾ · N 个文件改动 +N with the 全部展开/全部收起 toggle
// (r7 §3.6), one file row per changed file (chevron + name + 👁 +
// right-aligned +N), the unified-diff hunks when expanded (r7 27b) and
// the centered 暂无可显示的变更 placeholder when there is nothing to show
// (r7 38). #75 adds the version dropdown under the version chip (r8
// 63/70: version rows + 与其他版本对比… + 回到与 base 对比), the compare
// submenu (r8 64: 上一版本 alone) and the plan-version diff surface
// (r8 65–72: range chip `v1 → v2`, `+A −B` stats, del/add/marker rows).

import type {
  ChangesContent,
  DiffFile,
  DocBlock,
  PlanDiffContent,
  PlanVersion,
} from '../fixtures/records.js';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileTab,
  FileText,
  Restore,
  UnfoldVertical,
} from '../icons/index.js';
import { Segments } from './segments.js';

interface DocPaneProps {
  /** plan: 方案 header + markdown; changes: diff surface (review/done/
   *  failed); diff: plan-version unified diff (r8 65–72). */
  mode: 'plan' | 'changes' | 'diff';
  doc: DocBlock[] | undefined;
  changes: ChangesContent | undefined;
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
            显示完整文件
          </button>
        </div>
      )}
    </div>
  );
}

/** The floating version menu under the version chip / range chip: the
 *  version list (current row bold, restore glyph right), then
 *  与其他版本对比… (right label = the open diff's `from`, r8 70) and —
 *  only while a diff is open — 回到与 base 对比. */
function VersionMenu({
  versions,
  menu,
  diffOpen,
  diffFrom,
  onMenu,
  onCompare,
  onBase,
}: {
  versions: PlanVersion[];
  menu: 'versions' | 'compare';
  diffOpen: boolean;
  diffFrom?: string;
  onMenu: (menu: 'versions' | 'compare' | undefined) => void;
  onCompare: () => void;
  onBase: () => void;
}) {
  if (menu === 'compare') {
    return (
      <div className="version-menu version-menu--sub">
        <button type="button" className="version-menu-row" onClick={onCompare}>
          上一版本
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
            {row.v} · {row.rel}
          </span>
          <Restore width={13} height={13} />
        </button>
      ))}
      <button type="button" className="version-menu-row" onClick={() => onMenu('compare')}>
        <span>与其他版本对比…</span>
        {diffOpen && diffFrom != null && <span className="version-menu-label">{diffFrom}</span>}
      </button>
      {diffOpen && (
        <button type="button" className="version-menu-row" onClick={onBase}>
          <span>回到与 base 对比</span>
        </button>
      )}
    </div>
  );
}

export function DocPane({
  mode,
  doc,
  changes,
  planVersions,
  versionMenu,
  onVersionMenu,
  onCompare,
  onBase,
  planDiff,
  onToggleExpand,
}: DocPaneProps) {
  if (mode === 'changes' || mode === 'diff') {
    const files = mode === 'diff' ? (planDiff?.files ?? []) : (changes?.files ?? []);
    const expanded = mode === 'diff' ? (planDiff?.expanded ?? false) : (changes?.expanded ?? false);
    const fileCount = files.length;
    const added = files.reduce((sum, f) => sum + f.added, 0);
    const removed = files.reduce((sum, f) => sum + (f.removed ?? 0), 0);
    return (
      <section className="doc-pane">
        {mode === 'changes' && changes == null ? (
          <div className="doc-empty doc-empty--full">暂无可显示的变更</div>
        ) : (
          <>
            <header className="doc-pane-head">
              <FileTab width={14} height={14} />
              <button type="button" className="doc-pane-select">
                {mode === 'diff' ? '方案' : '变更'}
                <ChevronDown width={12} height={12} />
              </button>
              {mode === 'diff' && planDiff != null ? (
                <span className="doc-range-wrap">
                  <button
                    type="button"
                    className="doc-range-chip"
                    onClick={() =>
                      onVersionMenu?.(versionMenu === 'versions' ? undefined : 'versions')
                    }
                  >
                    {planDiff.from} → {planDiff.to}
                    <ChevronDown width={12} height={12} />
                  </button>
                  {versionMenu != null && onVersionMenu != null && planVersions != null && (
                    <VersionMenu
                      versions={planVersions}
                      menu={versionMenu}
                      diffOpen
                      diffFrom={planDiff.from}
                      onMenu={onVersionMenu}
                      onCompare={() => onCompare?.()}
                      onBase={() => onBase?.()}
                    />
                  )}
                </span>
              ) : (
                <span className="doc-range-wrap">
                  <button
                    type="button"
                    className="doc-pane-select"
                    onClick={() =>
                      onVersionMenu?.(versionMenu === 'versions' ? undefined : 'versions')
                    }
                  >
                    {planVersions?.[0]?.v ?? 'v1'}
                    <ChevronDown width={12} height={12} />
                  </button>
                  {versionMenu != null && onVersionMenu != null && planVersions != null && (
                    <VersionMenu
                      versions={planVersions}
                      menu={versionMenu}
                      diffOpen={false}
                      onMenu={onVersionMenu}
                      onCompare={() => onCompare?.()}
                      onBase={() => onBase?.()}
                    />
                  )}
                </span>
              )}
              <span className="doc-changes-stat">
                · {fileCount} 个文件改动 <span className="doc-changes-add">+{added}</span>
                {removed > 0 && <span className="doc-changes-del"> −{removed}</span>}
              </span>
              <button type="button" className="doc-expand-all" onClick={onToggleExpand}>
                {expanded ? '全部收起' : '全部展开'}
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
          <button type="button" className="doc-pane-select">
            方案
            <ChevronDown width={12} height={12} />
          </button>
          <span className="doc-range-wrap">
            <button
              type="button"
              className="doc-pane-select"
              onClick={() => onVersionMenu?.(versionMenu === 'versions' ? undefined : 'versions')}
            >
              {planVersions?.[0]?.v ?? 'v1'}
              <ChevronDown width={12} height={12} />
            </button>
            {versionMenu != null && onVersionMenu != null && planVersions != null && (
              <VersionMenu
                versions={planVersions}
                menu={versionMenu}
                diffOpen={false}
                onMenu={onVersionMenu}
                onCompare={() => onCompare?.()}
                onBase={() => onBase?.()}
              />
            )}
          </span>
        </header>
      )}
      <div className="doc-pane-body">
        {doc == null ? (
          <div className="doc-empty">暂无方案</div>
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
