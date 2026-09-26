// Composer (issue #56, r7 §3.4): box anchored x737 w687 h76, placeholder
// per phase, toolbar 语音输入/添加附件/AI 审核/提及 @ pitch 36, the 32×32
// send button, and the streaming stop square (r7 16). The 总管 FAB
// overlaps the send button in every capture (r7 §3.4), so the page renders
// the FAB after the composer and it covers the send pixels.
//
// M7 #310 附件 wire 改：
//   - draft 受控（live editable 面父持 state，附件 token 由父 setDraft 注入；
//     非 editable/fixture 静态 div 面，父不传 draft/onDraftChange → 内部
//     useState fallback，零行为差）
//   - 附件钮 = 原生文件多选触发器，选中文件 → onAttachment(files) 委托；
//     父组件负责 grant + upload + 拿到 token 后 setDraft 拼到 draft
//   - 覆盖层 chip 留 Task 6（detail 渲染面），此处只接管"选文件→返回 token"
//     的 wire，不动 textarea 几何

import { useRef, useState } from 'react';
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
  /** M7 #310：附件钮选中后调 onAttachment(files)，父组件负责
   * grant + upload + 拼 token 进 draft。父组件在 live 编辑面下应同时传
   * draft/onDraftChange 才能把 token 注入。 */
  onAttachment?: (files: File[]) => void | Promise<void>;
  /** M7 #310：受控 draft（live 面由父持 state，附件 token 才能注入）。 */
  draft?: string;
  onDraftChange?: (next: string) => void;
}

export function Composer({
  placeholder,
  aiReview,
  streaming,
  onSend,
  editable,
  onAttachment,
  draft: draftProp,
  onDraftChange,
}: ComposerProps) {
  const { t } = useI18n();
  const [internalDraft, setInternalDraft] = useState('');
  const controlled = draftProp !== undefined && onDraftChange !== undefined;
  const draft = controlled ? (draftProp as string) : internalDraft;
  const setDraft = controlled
    ? (next: string) => (onDraftChange as (s: string) => void)(next)
    : setInternalDraft;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attaching, setAttaching] = useState(false);
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
  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // 重置 value 允许同文件再选（change 事件不重发同源）
    e.target.value = '';
    if (files.length === 0 || !onAttachment) return;
    setAttaching(true);
    const result = onAttachment(files);
    void Promise.resolve(result).finally(() => setAttaching(false));
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
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={onPickFiles}
        // 客户端 mime 守门（与服务层 ALLOWED_MIME_* 镜像）；note accept 只是
        // hint，用户 OS 文件选择器仍可给其他类型，最终由 server 强拒兜底。
        accept="text/*,image/*,application/json,application/pdf,application/xml"
      />
      <div className="composer-toolbar">
        <button type="button" className="composer-tool" aria-label={t('语音输入')}>
          <Mic />
        </button>
        <button
          type="button"
          className="composer-tool"
          aria-label={t('添加附件')}
          disabled={attaching || !onAttachment}
          onClick={() => fileInputRef.current?.click()}
        >
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
      <button type="button" className="composer-send" aria-label={t('发送')} onClick={send}>
        <ArrowUp width={14} height={14} />
      </button>
    </div>
  );
}
