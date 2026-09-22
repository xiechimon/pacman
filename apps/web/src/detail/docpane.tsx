// Doc pane (issue #56, r7 §3.6 + 17): header selects 方案▾ / v1▾ over a
// divider, then the plan markdown; the planning state shows the centered
// 「暂无方案」 placeholder instead (r7 16). Todos carrying changes add the
// 变更▾ select and the README.md file row (r7 §3.6, 27/36 surfaces).

import type { DocBlock } from '../fixtures/records.js';
import { ChevronDown, FileTab, FileText } from '../icons/index.js';

interface DocPaneProps {
  doc: DocBlock[] | undefined;
  hasChanges: boolean;
}

export function DocPane({ doc, hasChanges }: DocPaneProps) {
  return (
    <section className="doc-pane">
      {doc != null && (
        <header className="doc-pane-head">
          <FileTab width={14} height={14} />
          <button type="button" className="doc-pane-select">
            方案
            <ChevronDown width={12} height={12} />
          </button>
          {hasChanges && (
            <button type="button" className="doc-pane-select">
              变更
              <ChevronDown width={12} height={12} />
            </button>
          )}
          <button type="button" className="doc-pane-select">
            v1
            <ChevronDown width={12} height={12} />
          </button>
        </header>
      )}
      {doc != null && hasChanges && (
        <div className="doc-file-row">
          <FileText width={14} height={14} />
          README.md
        </div>
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
              {block.segments.map((seg, j) =>
                seg.code ? (
                  <code key={j} className="doc-code">
                    {seg.text}
                  </code>
                ) : (
                  <span key={j}>{seg.text}</span>
                ),
              )}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
