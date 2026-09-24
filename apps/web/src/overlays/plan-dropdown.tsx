// 方案▾/变更▾ document-type dropdown (issue #67, r7 20 / r5b 05f; #149
// generalized to the changes/diff header select): 218×44 panel right-aligned
// under the doc-pane type button — a document-type selector only (current
// type ✓), not a confirm entry (r5b §3.7).

import { useI18n } from '../i18n/provider.js';
import { Check } from '../icons/index.js';
import './overlays.css';

export function PlanDropdown({ current = '方案' }: { current?: '方案' | '变更' }) {
  const { t } = useI18n();
  return (
    <div className="plan-dropdown" role="listbox" aria-label={t('文档类型')}>
      <button type="button" className="plan-dropdown-row" role="option" aria-selected={true}>
        {t(current)}
        <span className="plan-dropdown-check">
          <Check width={14} height={14} />
        </span>
      </button>
    </div>
  );
}
