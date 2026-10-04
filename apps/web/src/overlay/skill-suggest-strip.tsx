// Skill-suggestion hint bar (issue #823): the ghost-style strip shown when
// the wire matches plain prose to a team skill. Tab / click accepts (the
// skill token lands at the caret, the typed prose stays), the close button
// or Esc single-ignores. Rows are non-focusable and mousedown is swallowed
// so the textarea keeps DOM focus the whole time (the MentionInline combobox
// contract — a focus jump would re-judge the token and flicker the strip).
//
// The strip only ever renders while both completion popups are closed (the
// wire guarantees it), so it can sit in-flow under the textarea without
// covering any listbox.

import type { SkillSuggestion } from '@pacman/shared';
import { useI18n } from '../i18n/provider.js';
import { Puzzle, X } from '../icons/index.js';
import './skill-suggest.css';

interface SkillSuggestStripProps {
  suggestion: SkillSuggestion | null;
  onAccept: () => void;
  onDismiss: () => void;
}

export function SkillSuggestStrip({ suggestion, onAccept, onDismiss }: SkillSuggestStripProps) {
  const { t } = useI18n();
  if (suggestion === null) return null;
  return (
    <div className="skill-suggest" role="status">
      <button
        type="button"
        className="skill-suggest-body"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onAccept}
        aria-label={t('接受 skill 建议：{name}', { name: suggestion.skillName })}
        tabIndex={-1}
      >
        <span className="skill-suggest-icon">
          <Puzzle width={14} height={14} />
        </span>
        <span className="skill-suggest-text">
          {t('检测到 skill「{name}」，Tab 接受', { name: suggestion.skillName })}
        </span>
        <kbd className="skill-suggest-key">Tab</kbd>
      </button>
      <button
        type="button"
        className="skill-suggest-close"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onDismiss}
        aria-label={t('忽略 skill 建议')}
        tabIndex={-1}
      >
        <X width={14} height={14} />
      </button>
    </div>
  );
}
