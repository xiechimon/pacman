// 方案▾ document-type dropdown (issue #67, r7 20 / r5b 05f): 218×44 panel
// right-aligned under the doc-pane 方案▾ button — a document-type selector
// only (方案 ✓), not a confirm entry (r5b §3.7).

import { Check } from '../icons/index.js';
import './overlays.css';

export function PlanDropdown() {
  return (
    <div className="plan-dropdown" role="listbox" aria-label="文档类型">
      <button type="button" className="plan-dropdown-row" role="option" aria-selected={true}>
        方案
        <span className="plan-dropdown-check">
          <Check width={14} height={14} />
        </span>
      </button>
    </div>
  );
}
