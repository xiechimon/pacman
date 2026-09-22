// Composer (issue #56, r7 §3.4): box anchored x737 w687 h76, placeholder
// per phase, toolbar 语音输入/添加附件/AI 审核/提及 @ pitch 36, the 32×32
// send button, and the streaming stop square (r7 16). The 总管 FAB
// overlaps the send button in every capture (r7 §3.4), so the page renders
// the FAB after the composer and it covers the send pixels.

import { useI18n } from '../i18n/provider.js';
import { ArrowUp, Grid2x2, Mic, Paperclip, SearchPlus } from '../icons/index.js';

interface ComposerProps {
  placeholder: string;
  /** AI 审核 button joins the toolbar on writable review surfaces
   *  (r7 §4.1); planning shows the three base tools (r7 16). */
  aiReview: boolean;
  /** Live run: red stop square replaces the send affordance (r7 16). */
  streaming: boolean;
  /** Send click (issue #75 reject chain); absent = static capture face. */
  onSend?: () => void;
}

export function Composer({ placeholder, aiReview, streaming, onSend }: ComposerProps) {
  const { t } = useI18n();
  return (
    <div className="composer">
      <div className="composer-placeholder">{t(placeholder)}</div>
      <div className="composer-toolbar">
        <button type="button" className="composer-tool" aria-label={t('语音输入')}>
          <Mic />
        </button>
        <button type="button" className="composer-tool" aria-label={t('添加附件')}>
          <Paperclip />
        </button>
        {aiReview && (
          <button type="button" className="composer-tool" aria-label={t('AI 审核')}>
            <SearchPlus />
          </button>
        )}
        <button type="button" className="composer-tool" aria-label={t('提及')}>
          <Grid2x2 />
        </button>
      </div>
      {streaming && <button type="button" className="composer-stop" aria-label={t('停止')} />}
      <button type="button" className="composer-send" aria-label={t('发送')} onClick={onSend}>
        <ArrowUp width={14} height={14} />
      </button>
    </div>
  );
}
