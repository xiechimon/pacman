// Doc pane (issue #56, extended in #57 for the 变更 surface): plan mode
// keeps the 方案▾ / v1▾ header over the plan markdown (or the centered
// 暂无方案 placeholder in planning, r7 16). Changes mode (review/done)
// renders the diff header 变更▾ v1▾ · N 个文件改动 +N with the 全部展开/
// 全部收起 toggle (r7 §3.6), one file row per changed file (chevron +
// README.md + 👁 + right-aligned +N), the unified-diff hunks when
// expanded (r7 27b) and the centered 暂无可显示的变更 placeholder when
// there is nothing to show (r7 38).

import { useState } from 'react';
import type { ChangesContent, DiffFile, DocBlock } from '../fixtures/records.js';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileTab,
  FileText,
  UnfoldVertical,
} from '../icons/index.js';
import { ClickCatcher, useEscapeClose } from '../overlays/dismiss.js';
import { PlanDropdown } from '../overlays/plan-dropdown.js';
import { Segments } from './segments.js';

interface DocPaneProps {
  /** plan: 方案 header + markdown; changes: diff surface (review/done). */
  mode: 'plan' | 'changes';
  doc: DocBlock[] | undefined;
  changes: ChangesContent | undefined;
  /** Scenario-frozen initial open state of the 方案▾ dropdown (#67). */
  planDropdownOpen?: boolean;
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
        <span className="doc-file-add">+{file.added}</span>
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
                  <span className="diff-mark">{line.kind === 'add' ? '+' : ''}</span>
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

export function DocPane({ mode, doc, changes, planDropdownOpen }: DocPaneProps) {
  const [typeOpen, setTypeOpen] = useState(planDropdownOpen === true);
  useEscapeClose(typeOpen, () => setTypeOpen(false));
  if (mode === 'changes') {
    const fileCount = changes?.files.length ?? 0;
    const added = changes?.files.reduce((sum, f) => sum + f.added, 0) ?? 0;
    return (
      <section className="doc-pane">
        {changes == null ? (
          <div className="doc-empty doc-empty--full">暂无可显示的变更</div>
        ) : (
          <>
            <header className="doc-pane-head">
              <FileTab width={14} height={14} />
              <button type="button" className="doc-pane-select">
                变更
                <ChevronDown width={12} height={12} />
              </button>
              <button type="button" className="doc-pane-select">
                v1
                <ChevronDown width={12} height={12} />
              </button>
              <span className="doc-changes-stat">
                · {fileCount} 个文件改动 <span className="doc-changes-add">+{added}</span>
              </span>
              <button type="button" className="doc-expand-all">
                {changes.expanded ? '全部收起' : '全部展开'}
              </button>
            </header>
            {changes.files.map((file) => (
              <DiffFileBlock key={file.path} file={file} expanded={changes.expanded} />
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
              方案
              <ChevronDown width={12} height={12} />
            </button>
            {typeOpen && (
              <>
                <ClickCatcher onClose={() => setTypeOpen(false)} />
                <PlanDropdown />
              </>
            )}
          </span>
          <button type="button" className="doc-pane-select">
            v1
            <ChevronDown width={12} height={12} />
          </button>
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
