// Composer (issue #56, r7 §3.4): box anchored x737 w687 h76, placeholder
// per phase, toolbar 语音输入/添加附件/AI 审核/提及 @ pitch 36, the 32×32
// send button, and the streaming stop square (r7 16). The 总管 FAB
// overlaps the send button in every capture (r7 §3.4), so the page renders
// the FAB after the composer and it covers the send pixels.
//
// #311: the 提及 button now opens a MentionPicker popover and the
// textarea tracks `@`-prefixed token positions to expose an inline
// agents-only listbox (r9 §3.2). Both paths route through
// insertMentionText so the picked mention lands at the caret position
// without losing focus. The picker is data-source agnostic — the
// caller (todo-detail-page) feeds in MentionGroups derived from
// either live REST hooks or the fixture set.

import { useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/provider.js';
import { ArrowUp, Grid2x2, Mic, Paperclip, SearchPlus } from '../icons/index.js';
import { type MentionGroups, MentionInline, MentionPicker } from '../overlay/mention-picker.js';
import {
  detectInlineAgentQuery,
  insertMentionText,
  type MentionToken,
} from '../overlay/mention-token.js';

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
  /** #311：实体集合。live = 父级用 useMembers/useTodos/useSkills/useProjects/useMachines
   *  投影；fixture = 父级从 fixture.todos / fixture.resources 提取。
   *  缺省 = 所有分组空（弹层仍可开但只显 0 计数）。 */
  mentionGroups?: MentionGroups;
}

export function Composer({
  placeholder,
  aiReview,
  streaming,
  onSend,
  editable,
  mentionGroups,
}: ComposerProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineCaret, setInlineCaret] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
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

  /** Insert a mention token at the current caret position. Used by
   *  both the MentionPicker (toolbar click) and the @ inline
   *  listbox — same code path so the spacing + caret offset rules
   *  live in one place. */
  const insertToken = (token: MentionToken) => {
    const ta = textareaRef.current;
    if (ta == null) {
      setDraft((current) => insertMentionText(current, token, null).value);
      return;
    }
    // For the @ inline path, replace from the @-prefix start to the
    // caret so the resulting text carries just ` @agent-name ` and
    // the original `@partial` query is dropped.
    const caret = ta.selectionStart ?? draft.length;
    let at = caret;
    if (inlineOpen) {
      const query = detectInlineAgentQuery(draft, caret);
      if (query !== null) {
        at = caret - query.length - 1; // -1 for the leading `@`
      }
    }
    const { value, caret: nextCaret } = insertMentionText(draft, token, at);
    setDraft(value);
    // Re-focus the textarea + restore the caret after React commits
    // the new value. requestAnimationFrame avoids a frame where the
    // DOM still holds the stale draft.
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(nextCaret, nextCaret);
    });
    setInlineOpen(false);
    setInlineCaret(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setDraft(next);
    if (!editable) return;
    const caret = e.target.selectionStart ?? next.length;
    const query = detectInlineAgentQuery(next, caret);
    if (query !== null && mentionGroups && mentionGroups.agent.length > 0) {
      setInlineOpen(true);
      setInlineCaret(caret);
    } else {
      setInlineOpen(false);
      setInlineCaret(null);
    }
  };

  // Filter the agents listbox by the partial query after `@` so
  // typing `@r3` narrows to r3-builder. When query is empty every
  // agent is shown.
  const inlineAgents = useMemo(() => {
    if (!mentionGroups) return [];
    const caret = inlineCaret ?? 0;
    const query = detectInlineAgentQuery(draft, caret) ?? '';
    const q = query.toLowerCase();
    if (q === '') return mentionGroups.agent;
    return mentionGroups.agent.filter((a) => a.label.toLowerCase().includes(q));
  }, [mentionGroups, draft, inlineCaret]);

  // Empty groups still let the picker open so the user sees the
  // zero counts (matches r9 §2.2 first layer).
  const groups = mentionGroups ?? {
    todo: [],
    skill: [],
    agent: [],
    project: [],
    machine: [],
  };

  return (
    <div className="composer composer--with-mention">
      {editable ? (
        <div className="composer-input-wrap">
          <textarea
            ref={textareaRef}
            className="composer-placeholder composer-input"
            placeholder={t(placeholder)}
            value={draft}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && inlineOpen) {
                e.preventDefault();
                setInlineOpen(false);
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <MentionInline
            open={inlineOpen}
            agents={inlineAgents}
            caret={inlineCaret}
            onPick={(entry) =>
              insertToken({
                kind: 'agent',
                id: entry.id,
                label: entry.label,
              })
            }
            onClose={() => {
              setInlineOpen(false);
              setInlineCaret(null);
            }}
          />
        </div>
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
        <button
          type="button"
          className="composer-tool"
          aria-label={t('提及')}
          onClick={() => setPickerOpen((value) => !value)}
        >
          <Grid2x2 />
        </button>
      </div>
      {streaming && <button type="button" className="composer-stop" aria-label={t('停止')} />}
      <button type="button" className="composer-send" aria-label={t('发送')} onClick={send}>
        <ArrowUp width={14} height={14} />
      </button>
      <MentionPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        groups={groups}
        onInsert={(tokens) => {
          for (const token of tokens) insertToken(token);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
