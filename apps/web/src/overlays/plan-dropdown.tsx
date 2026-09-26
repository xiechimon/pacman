// 方案▾/变更▾ document-type dropdown (issue #67, r7 20 / r5b 05f; #149
// generalized to the changes/diff header select): 218×44 panel right-aligned
// under the doc-pane type button — a document-type selector only (current
// type ✓), not a confirm entry (r5b §3.7). Row click = pick the (sole)
// current type and close — the lang-dropdown select-and-close law (#306
// 校准: a rendered option row must act, not just check).

import { useI18n } from '../i18n/provider.js';
import { Check } from '../icons/index.js';
import './overlays.css';

export function PlanDropdown({
  current = '方案',
  onSelect,
}: {
  current?: '方案' | '变更';
  /** Row click: the single option re-selects itself — the owner closes
   *  the dropdown (same contract as lang-dropdown rows). */
  onSelect?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="plan-dropdown" role="listbox" aria-label={t('文档类型')}>
      <button
        type="button"
        className="plan-dropdown-row"
        role="option"
        aria-selected={true}
        onClick={onSelect}
      >
        {t(current)}
        <span className="plan-dropdown-check">
          <Check width={14} height={14} />
        </span>
      </button>
    </div>
  );
}
