// Composer (issue #56, r7 §3.4): box anchored x737 w687 h76, placeholder
// per phase, toolbar 语音输入/添加附件/AI 审核/提及 @ pitch 36, the 32×32
// send button, and the streaming stop square (r7 16). The 总管 FAB
// overlaps the send button in every capture (r7 §3.4), so the page renders
// the FAB after the composer and it covers the send pixels.

import { useState } from 'react';
import { useI18n } from '../i18n/provider.js';
import { ArrowUp, Grid2x2, Mic, Paperclip, SearchPlus } from '../icons/index.js';

interface ComposerProps {
  placeholder: string;
  /** AI 审核 button joins the toolbar on writable review surfaces
   *  (r7 §4.1); planning shows the three base tools (r7 16). */
  aiReview: boolean;
  /** Live run: red stop square replaces the send affordance (r7 16). */
  streaming: boolean;
  /** Send click (issue #75 reject chain); absent = static capture face.
   *  M5: the text argument carries the typed draft on editable (live)
   *  faces; fixture callers ignore it. 返回 Promise = 异步发送（W3 #280
   *  steer 面：rejected 时 draft 保留不丢字）；同步 void = 发后即清（原语义）。 */
  onSend?: (text: string) => void | Promise<void>;
  /** M5 live 面：占位行换成真 textarea（同几何类名 + input 复位类；
   * fixture/parity 面保持静态 div，DOM 不变）。 */
  editable?: boolean;
  /** 停止钮点击（M7 #308，r9 §3.3：确认弹层入口）；缺省 = 静态捕获面
   * （fixture/parity 按钮不接线，DOM 字节不变）。 */
  onStop?: () => void;
}

export function Composer({
  placeholder,
  aiReview,
  streaming,
  onSend,
  editable,
  onStop,
}: ComposerProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const send = () => {
    const text = draft.trim();
    if (text === '' && !editable) {
      onSend?.(text);
      return;
    }
    if (text === '') return;
    const result = onSend?.(text);
    if (result instanceof Promise) {
      // 异步面（steer）：成功清稿；失败（409 拒绝）保留 draft 不丢字。
      void result.then(() => setDraft('')).catch(() => {});
    } else {
      setDraft('');
    }
  };
  return (
    <div className="composer">
      {editable ? (
        <textarea
          className="composer-placeholder composer-input"
          placeholder={t(placeholder)}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
      ) : (
        <div className="composer-placeholder">{t(placeholder)}</div>
      )}
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
      {streaming && (
        <button type="button" className="composer-stop" aria-label={t('停止')} onClick={onStop} />
      )}
      <button type="button" className="composer-send" aria-label={t('发送')} onClick={send}>
        <ArrowUp width={14} height={14} />
      </button>
    </div>
  );
}
