// Composer (issue #56, r7 §3.4): box anchored x737 w687 h76, placeholder
// per phase, toolbar 添加附件/AI 审核/提及 @ pitch 36, the 32×32
// send button, and the streaming stop button (r7 16). The 总管 FAB
// overlaps the send button in every capture (r7 §3.4), so the page renders
// the FAB after the composer and it covers the send pixels.
// XMON-55 P5: the stop is no longer a 14×14 bare red square — it is the send
// button's sibling (32×32, same fill, same bottom axis, 8px apart) carrying a
// 10px --stop glyph; the send lights up on the brand solid once a draft
// exists. Geometry and rationale live in detail.css.
//
// M7 #310 附件 wire 改（#625 起实现住 overlay/composer-wire 的
// useComposerWire，本文件只消费；契约不变）：
//   - draft 受控（live editable 面父持 state，附件 token 由父 setDraft 注入；
//     非 editable/fixture 静态 div 面，父不传 draft/onDraftChange → 内部
//     useState fallback，零行为差）
//   - 附件钮 = 原生文件多选触发器，选中文件 → onAttachment(files) 委托；
//     父组件负责 grant + upload + 拿到 token 后 setDraft 拼到 draft
//   - 覆盖层 chip 留 Task 6（detail 渲染面），此处只接管"选文件→返回 token"
//     的 wire，不动 textarea 几何
//
// #304（08 册 C5 裁决）:语音输入功能不做——原站工具条首钮(语音)移除
// 不渲染,wontfix 理由 = local-first 无语音输入面;#146 chief 面
// 同律先例;Mic 图标随之出账(generate-icons PRUNED)。
//
// #311: the 提及 button now opens a MentionPicker popover and the
// textarea tracks `@`-prefixed token positions to expose an inline
// agents-only listbox (r9 §3.2). Both paths route through
// insertMentionText so the picked mention lands at the caret position
// without losing focus (#625: both paths live in useComposerWire, this
// file renders the popover/inline skins). The picker is data-source
// agnostic — the caller (todo-detail-page) feeds in MentionGroups
// derived from either live REST hooks or the fixture set.

import { Button } from '../components/ui/button.js';
import { useI18n } from '../i18n/provider.js';
import { ArrowUp, Grid2x2, Paperclip, SearchPlus } from '../icons/index.js';
import { AttachmentStrip } from '../overlay/attachment-strip.js';
import { useComposerWire } from '../overlay/composer-wire.js';
import { type MentionGroups, MentionInline, MentionPicker } from '../overlay/mention-picker.js';
import type { FileMentionEntry } from '../overlay/mention-token.js';
import { SlashHelp, SlashMenu } from '../overlay/slash-menu.js';
import { ComposerChips } from './composer-chips.js';

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
   * fixture 面保持静态 div，DOM 不变）。 */
  editable?: boolean;
  /** M7 #310（#729 契约收窄）：附件钮选中 / 剪贴板粘贴后调
   * onAttachment(files)，父组件负责 grant + upload，返回成功文件的
   * token；注入 draft（行原子、粘贴落 caret 位）由 useComposerWire 统一
   * 做。父组件在 live 编辑面下应同时传 draft/onDraftChange 才能接住注入。 */
  onAttachment?: (files: File[]) => string[] | Promise<string[]>;
  /** M7 #310：受控 draft（live 面由父持 state，附件 token 才能注入）。 */
  draft?: string;
  onDraftChange?: (next: string) => void;
  /** #311：实体集合。live = 父级用 useMembers/useTodos/useSkills/useProjects/useMachines
   *  投影；fixture = 父级从 fixture.todos / fixture.resources 提取。
   *  缺省 = 所有分组空（弹层仍可开但只显 0 计数）。 */
  mentionGroups?: MentionGroups;
  /** #760：文件候选（`GET /api/projects/:id/files` 投影）。缺省/空 = #728
   *  agents-only 内联面，字节行为不变。 */
  mentionFiles?: FileMentionEntry[];
  /** 停止钮点击（M7 #308，r9 §3.3：确认弹层入口）；缺省 = 静态捕获面
   * （fixture 按钮不接线，DOM 字节不变）。 */
  onStop?: () => void;
  /** AI 审核钮点击（M7 #312，r8 §3.1：发起 AI 审核模态入口）；缺省 =
   * 静态捕获面（fixture 按钮不接线，DOM 字节不变）。 */
  onReview?: () => void;
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
  mentionGroups,
  mentionFiles,
  onStop,
  onReview,
}: ComposerProps) {
  const { t } = useI18n();
  // #625：输入逻辑层单源——draft / 发送（异步被拒保留 draft）/ 提及双路 /
  // 附件选件 wire 全住 overlay/composer-wire 的 useComposerWire，chief 抽屉
  // 消费同一 hook；本文件只剩 detail 皮肤（节点、几何、工具条三钮）。
  const {
    draft,
    send,
    handleChange,
    handleKeyDown,
    handleCaretMoved,
    handleCompositionEnd,
    handleBlur,
    textareaRef,
    fileInputRef,
    openFilePicker,
    attaching,
    pendingAttachments,
    onPickFiles,
    handlePaste,
    pickerOpen,
    togglePicker,
    closePicker,
    inlineOpen,
    inlineCaret,
    inlineQuery,
    inlineRows,
    inlineHighlight,
    setInlineHighlight,
    inlineListboxId,
    inlineListboxRef,
    insertToken,
    insertTokens,
    insertFile,
    groups,
    // #731 `/` slash completion: availability mirrors the toolbar buttons'
    // own display conditions (a command with no live action is omitted,
    // never a dead row).
    slashOpen,
    slashQuery,
    slashCaret,
    slashSections,
    slashHighlight,
    setSlashHighlight,
    slashListboxId,
    slashListboxRef,
    acceptSlashRow,
    helpOpen,
    closeHelp,
    helpRows,
    helpSkillCount,
  } = useComposerWire({
    editable,
    draft: draftProp,
    onDraftChange,
    onSend,
    onAttachment,
    mentionGroups,
    mentionFiles,
    slash: {
      reviewAvailable: aiReview && onReview !== undefined,
      stopAvailable: streaming && onStop !== undefined,
      ...(onReview !== undefined ? { onReview } : {}),
      ...(onStop !== undefined ? { onStop } : {}),
    },
  });

  return (
    <div className="composer composer--with-mention">
      {editable ? (
        <div className="composer-input-wrap">
          {/* #728 combobox wiring: while the inline listbox is open the
              textarea announces itself as the combobox and points
              aria-activedescendant at the highlighted row — it keeps DOM
              focus the whole time (the listbox rows are non-focusable).
              keyup/click/select re-judge the token after caret-only moves
              (a change event never fires for those). */}
          <textarea
            ref={textareaRef}
            className="composer-placeholder composer-input"
            placeholder={t(placeholder)}
            value={draft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            // #729: clipboard images/files ride the #310 attachFile chain;
            // a text-only paste never reaches the handler's preventDefault.
            onPaste={handlePaste}
            onKeyUp={handleCaretMoved}
            onClick={handleCaretMoved}
            onSelect={handleCaretMoved}
            onCompositionEnd={handleCompositionEnd}
            onBlur={handleBlur}
            {...(inlineOpen
              ? {
                  role: 'combobox',
                  'aria-expanded': true,
                  'aria-controls': inlineListboxId,
                  'aria-autocomplete': 'list' as const,
                }
              : {})}
            {...(inlineOpen && inlineHighlight != null
              ? { 'aria-activedescendant': `${inlineListboxId}-opt-${inlineHighlight}` }
              : {})}
          />
          <MentionInline
            open={inlineOpen}
            rows={inlineRows}
            caret={inlineCaret}
            query={inlineQuery}
            highlight={inlineHighlight}
            onHover={setInlineHighlight}
            onPick={(row) => {
              if (row.kind === 'agent') {
                insertToken({
                  kind: 'agent',
                  id: row.id,
                  label: row.label,
                });
              } else {
                insertFile(row.label);
              }
            }}
            listboxRef={inlineListboxRef}
            listboxId={inlineListboxId}
          />
          {/* #731 `/` slash menu: same combobox anchor/geometry as the `@`
              listbox above. Click = Enter-with-highlight semantics. */}
          <SlashMenu
            open={slashOpen}
            sections={slashSections.map((s) => ({
              title: s.section === 'builtin' ? t('命令') : t('技能'),
              rows: s.rows,
            }))}
            caret={slashCaret}
            query={slashQuery}
            highlight={slashHighlight}
            onHover={setSlashHighlight}
            onPick={(row) => acceptSlashRow(row, 'enter')}
            listboxRef={slashListboxRef}
            listboxId={slashListboxId}
          />
        </div>
      ) : (
        <div className="composer-placeholder">{t(placeholder)}</div>
      )}
      {/* #757 附件 strip + #812 提及 strip：同一浮列挂盒外上方（盒几何
          76px 冻结，浮列与 listbox 同锚无布局位移）。共列即天然上下叠放，
          两面永不互盖；各 strip 空时零节点，列空即零高度不绘制。 */}
      <div className="composer-float">
        <ComposerChips draft={draft} files={mentionFiles} suspended={inlineOpen || slashOpen} />
        <AttachmentStrip draft={draft} pending={pendingAttachments} />
      </div>
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
        {/* #304 C5 裁决:语音输入功能不做(local-first 无语音面)——原站
            首钮移除不渲染,不留死钮;添加附件/AI 审核/提及原样。
            XMON-24：三工具钮切 shadcn ghost——皮肤全在 .composer-tool
            per-face；附件钮可 disabled，老面无禁用降档（无 :disabled
            规则）→ opacity/pointer-events 双双中性化；svg 免底座强制
            16px（图标默认 18px 属性）。 */}
        <Button
          variant="ghost"
          className="composer-tool font-normal disabled:opacity-100 disabled:pointer-events-auto active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
          aria-label={t('添加附件')}
          disabled={attaching || !onAttachment}
          onClick={openFilePicker}
        >
          <Paperclip />
        </Button>
        {aiReview && (
          <Button
            variant="ghost"
            className="composer-tool font-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
            aria-label={t('AI 审核')}
            onClick={onReview}
          >
            <SearchPlus />
          </Button>
        )}
        <Button
          variant="ghost"
          className="composer-tool font-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
          aria-label={t('提及')}
          onClick={togglePicker}
        >
          <Grid2x2 />
        </Button>
      </div>
      {streaming && (
        // XMON-24：停止钮切 shadcn ghost——漆底/定位/尺寸全在
        // .composer-stop per-face（漆面压过 hover:bg-muted）；只清 active 位移。
        <Button
          variant="ghost"
          className="composer-stop active:not-aria-[haspopup]:translate-y-0"
          aria-label={t('停止')}
          onClick={onStop}
        >
          <span className="composer-stop-glyph" />
        </Button>
      )}
      {/* XMON-24：发送钮切 shadcn ghost——漆底/过渡钉全在 .composer-send
          (--ready) per-face；ArrowUp 属性 14px，svg 免底座强制 16px。 */}
      <Button
        variant="ghost"
        className={`${draft.trim() === '' ? 'composer-send' : 'composer-send composer-send--ready'} active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto`}
        aria-label={t('发送')}
        onClick={send}
      >
        <ArrowUp width={14} height={14} />
      </Button>
      <MentionPicker
        open={pickerOpen}
        onClose={closePicker}
        groups={groups}
        onInsert={(tokens) => {
          insertTokens(tokens);
          closePicker();
        }}
      />
      {/* #731 `/help` panel: read-only FloatingShell over the available
          builtins. */}
      <SlashHelp
        open={helpOpen}
        onClose={closeHelp}
        commands={helpRows}
        skillCount={helpSkillCount}
      />
    </div>
  );
}
