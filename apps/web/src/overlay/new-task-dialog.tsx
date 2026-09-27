// New-task dialog (issue #66, r7 04/14): 672×439 centered modal over the
// board. Head = project chip + centered 新建任务 + close; body = title
// input (placeholder 需要做什么？) over the five-line spec template;
// footer = 标签 row + composer-style toolbar + 保存 / 保存并开始.
// 04 vs 14: the primary button sits disabled (washed indigo) until the
// title carries text. Fixture phase: saving appends the todo to the
// board's client-side set (r2 §4.2 count coupling, 刚刚 label); the
// start-task overlay behind 保存并开始 is a later ticket (03 §M0+).
// #176: the project chip is a selector — click opens an anchored popover
// (family law #67/#127: OverlayMount + ClickCatcher + Esc, dhead chip
// popover precedent), rows = the project set (live = useProjects truth;
// fixture = scenario projectNames / canon default), selection is pure
// form state that backfills the chip and rides the submit's projectId.
// #309: the footer 添加标签 dashed circle joins the wire (r9 §2.5/§3.4) —
// 448-family tag panel (pill toggle + inline create form) portal-mounted
// on body: the dialog's transform containing block + overflow:hidden
// would otherwise clip a viewport-centered panel ([设计], first portal of
// the family). Live face: tags/onCreateTag ride the project's tag set
// (POST /api/projects/{id}/tags, color = TAG_DEFAULT_COLOR client-side
// default per r9 §3.4); fixture face creates into dialog-local state.
// Selection rides the submit's tagIds (r9 §3.4 createTodo body 携带位).
// A3-overlays 收编：footer 双钮 = ui/Button（ghost / primary，弹窗语义
// standard 32 档，r7 实测 30 归一到原语三档）；两钮类名无 e2e/parity
// 钉扎，散写规则随收编移除。
// #311: spec textarea now owns state + the 提及 button opens the same
// MentionPicker the composer uses. Mention tokens land at the spec
// caret position via insertMentionText — the spec rides along to the
// createTodo body unchanged, and the rendering side (Segments) parses
// them back into chips when the description is shown later.
// #318 未保存闸 (r9 §3.4): 标题/描述任一非空时,三条关闭路径(X / backdrop /
// Esc)先过「放弃新建任务？未保存的内容将丢失。」确认弹层(继续编辑 / 放弃
// 并关闭);净表单直关不闸。Esc 分层 4 层沿 #176 内层优先律(确认层 → 提及
// picker → 项目 popover → dialog)。附件/标签的 dirty 位归 #309/#310 接线
// 时扩展。关闭即重置表单(retained-mount 重开 = 净面,闸判定不带脏残留)。

import { TAG_DEFAULT_COLOR } from '@pacman/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PROJECT_ID, PROJECT_NAME } from '../fixtures/fixtures.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronDown, Grid2x2, Paperclip, PlusSmall, X } from '../icons/index.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from '../overlays/dismiss.js';
import { Button } from '../ui/button.js';
import { DialogShell } from '../ui/dialog-shell.js';
import { TagChip, type TagChipData } from '../ui/tag-chip.js';
import { type MentionGroups, MentionPicker } from './mention-picker.js';
import { insertMentionText, type MentionToken } from './mention-token.js';
import { useEscClose } from './use-esc.js';
import { FADE_EXIT_MS } from './use-overlay-mount.js';
import './overlay.css';

/** Spec textarea template lines, verbatim r2 §5.2 / r7 04 placeholder
 *  block — dict keys so the en fallback carries them too. */
const SPEC_TEMPLATE_LINES = [
  '我想要的结果：',
  '现在的情况：',
  '需要保留或避免：',
  '我会这样确认完成：',
  '我希望收到：',
];

/** #176 选择器行:live = ProjectRecord 最小投影(id/name);fixture =
 *  scenario projectNames。 */
interface ProjectOption {
  id: string;
  name: string;
}

/** #309 标签行:live = TagRecord 最小投影(ui/tag-chip TagChipData 单源);
 *  fixture = dialog-local 新建集(无 server 面)。 */
type TagOption = TagChipData;

/** fixture 面项目集兜底:scenarios 不带 projectNames 时退 canon 单默认
 *  项目(r3-lifecycle,#176 票面「至少默认项目」)。 */
const DEFAULT_PROJECT: ProjectOption = { id: PROJECT_ID, name: PROJECT_NAME };

interface NewTaskDialogProps {
  /** #73: retained-mount open flag — the exit fade outlives the close. */
  open: boolean;
  onClose: () => void;
  /** #176:提交携带选中项目 id(选择是纯表单 state,无 mutation)。
   *  #309:tagIds = 面板选中集(空数组照携,r9 §3.4 wire 观测位)。
   *  #311：spec 参数携带 mention token 内容——父级负责透传到
   *  createTodo body。fixture 行为忽略 tagIds/spec。 */
  onSave: (title: string, projectId?: string, tagIds?: string[], spec?: string) => void;
  /** M5 live 面：保存并开始 = 创建 + POST builds（r2 §4.2 双钮语义）；
   * 缺省 = fixture 行为（同 保存）。 #309 tagIds + #311 spec 双参数同携。 */
  onSaveAndStart?: (title: string, projectId?: string, tagIds?: string[], spec?: string) => void;
  /** M5 live：项目集真值(选择器行数据源);缺省 = fixture canon 单默认
   *  项目(live = projectsQ 投影,fixture = scenario projectNames)。 */
  projects?: ProjectOption[];
  /** #309 live:当前选中项目的标签集真值(useTags 投影);缺省 =
   *  fixture 面(dialog-local 新建集兜底)。 */
  tags?: TagOption[];
  /** #309 live:新建标签 = POST tags,解析出新 tag id(建后自动选中,
   *  r9 94→95);缺省 = fixture 面 local 新建。失败由调用面呈现,面板
   *  保持表单态供重试。 */
  onCreateTag?: (name: string) => Promise<string>;
  /** #309 live:选中项目上报(tags 查询键随动;board-page 传 setter,
   *  稳定引用)。选择仍是 dialog 内纯表单 state(#176 律不变)。 */
  onProjectChange?: (projectId: string | undefined) => void;

  /** #311: mention picker groups（5 类别）。父级从 live hooks 或
   *  fixture 派生；缺省 = 空集合（picker 首层 0 计数）。 */
  mentionGroups?: MentionGroups;
}

export function NewTaskDialog({
  open,
  onClose,
  onSave,
  onSaveAndStart,
  projects,
  tags,
  onCreateTag,
  onProjectChange,

  mentionGroups,
}: NewTaskDialogProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  // #311：spec textarea 现属表单 state,mention token 落此处;retained-mount
  // 重开不得带回上次未提交的提及（与 projectOpen reset 同律）。#318：spec
  // 入受控 = 闸的 dirty 判定源;placeholder 模板行不变。
  const [spec, setSpec] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  // #318 未保存闸确认层开态
  const [discardOpen, setDiscardOpen] = useState(false);
  // #176 选择器 state:popover 开态 + 选中行。null = 未动,展示/提交取
  // 首行;live 空项目集时 selected 退 undefined(chip 走 canon 名)。
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  // #309 标签面 state:panel 开态 + 选中集 + 内联新建表单 + fixture-local
  // 新建集(live 面恒空,真值走 tags prop)。
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagFormOpen, setTagFormOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagCreating, setTagCreating] = useState(false);
  const [localTags, setLocalTags] = useState<TagOption[]>([]);
  const rows = projects ?? [DEFAULT_PROJECT];
  const selected = rows.find((row) => row.id === projectId) ?? rows[0];
  const projectName = selected?.name ?? PROJECT_NAME;
  const selectedProjectId = selected?.id;
  const tagList = useMemo(() => [...(tags ?? []), ...localTags], [tags, localTags]);
  const selectedTags = tagList.filter((tag) => selectedTagIds.includes(tag.id));
  // #318: 附件/标签尚无表单 state(#309/#310 接线时并入 dirty 位)
  const dirty = title.trim() !== '' || spec.trim() !== '';
  const requestClose = () => {
    if (dirty) setDiscardOpen(true);
    else onClose();
  };
  // Esc 分层 4 层(内层优先):确认层 → 提及 picker → 项目 popover → dialog 关闸
  // (合并 #311 picker + #318 闸;discardOpen/pickerOpen 由各自 ClickCatcher
  // / useEscapeClose 单独处理,这里只控 dialog 自身的 Esc 关闸。)
  useEscClose(requestClose, open && !projectOpen && !pickerOpen && !discardOpen);
  useEscapeClose(projectOpen, () => setProjectOpen(false));
  useEscapeClose(discardOpen, () => setDiscardOpen(false));
  // retained mount:dialog 关闭一并收 popover + 确认层 + picker,并重置表单
  // (重开不得带回开态/脏字——闸判定以净面起步)
  useEffect(() => {
    if (!open) {
      setProjectOpen(false);
      setTagPanelOpen(false);
      setTagFormOpen(false);
      setTagName('');
      setSelectedTagIds([]);
      setLocalTags([]);
      setDiscardOpen(false);
      setPickerOpen(false);
      setTitle('');
      setSpec('');
    }
  }, [open]);
  // #309:选中项目上报(live tags 查询键)+ 换项目清选中(标签属项目,
  // 跨界选中无意义 [设计])。undefined→首个项目 不清——无项目库建标签会
  // 先落默认项目(board-page),清选中会吃掉「建后自动选中」(r9 94→95)。
  useEffect(() => {
    if (open) onProjectChange?.(selectedProjectId);
  }, [open, selectedProjectId, onProjectChange]);
  const prevProjectRef = useRef(selectedProjectId);
  useEffect(() => {
    if (prevProjectRef.current !== undefined && prevProjectRef.current !== selectedProjectId) {
      setSelectedTagIds([]);
    }
    prevProjectRef.current = selectedProjectId;
  }, [selectedProjectId]);
  // retained mount means reopen is not a remount — refocus like a fresh one
  const inputRef = useRef<HTMLInputElement>(null);
  const specRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  // #309 内联新建表单同律:开表单即聚焦名称 input(a11y 面禁 autoFocus 属性,
  // 走 ref 聚焦——dialog 标题 input 先例)。
  const tagInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (tagFormOpen) tagInputRef.current?.focus();
  }, [tagFormOpen]);

  const toggleTag = (id: string) =>
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submitNewTag = async () => {
    const name = tagName.trim();
    if (name === '' || tagCreating) return;
    if (onCreateTag) {
      setTagCreating(true);
      try {
        const id = await onCreateTag(name);
        setSelectedTagIds((prev) => [...prev, id]); // r9 94→95:建后自动选中
        setTagName('');
        setTagFormOpen(false);
      } catch {
        // live 创建失败:表单与输入保留供重试(失败呈现归调用面)
      } finally {
        setTagCreating(false);
      }
      return;
    }
    // fixture 面:dialog-local 新建(无 server 面;保存时 tagIds 照携,
    // fixture 落卡路径忽略之——看板卡不渲染标签,spec 08 附录 A 校准)。
    const id = crypto.randomUUID();
    setLocalTags((prev) => [...prev, { id, name, color: TAG_DEFAULT_COLOR }]);
    setSelectedTagIds((prev) => [...prev, id]);
    setTagName('');
    setTagFormOpen(false);
  };

  const save = () => onSave(title.trim(), selected?.id, selectedTagIds, spec);

  // #318 放弃并关闭:清表单 + 关 dialog(父收 open,重置 effect 兜底同律)
  const discardAndClose = () => {
    setDiscardOpen(false);
    setTitle('');
    setSpec('');
    onClose();
  };

  // Mention insert: route through insertMentionText so the picker
  // and the inline @ listbox share the spacing + caret rules.
  const insertToken = (token: MentionToken) => {
    const ta = specRef.current;
    if (ta == null) {
      setSpec((current) => insertMentionText(current, token, null).value);
      return;
    }
    const caret = ta.selectionStart ?? spec.length;
    const { value, caret: nextCaret } = insertMentionText(spec, token, caret);
    setSpec(value);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const groups = mentionGroups ?? {
    todo: [],
    skill: [],
    agent: [],
    project: [],
    machine: [],
  };
  return (
    <OverlayMount open={open} exitMs={FADE_EXIT_MS}>
      <button
        type="button"
        className="overlay-backdrop anim-fade"
        aria-label={t('关闭')}
        onClick={() => {
          // 外点内层优先:panel 的 transform 收 fixed ClickCatcher 容器,
          // 外点直达此 backdrop。discardOpen 由确认层自己的 ClickCatcher
          // 接管(z29 压 dialog z21,外点只收确认层),这里处理 picker /
          // project popover 的内层先关;剩余走 dirty 闸 / 直接关。
          if (projectOpen) {
            setProjectOpen(false);
            return;
          }
          if (pickerOpen) {
            setPickerOpen(false);
            return;
          }
          requestClose();
        }}
      />
      <div
        className="new-task-dialog anim-fade"
        role="dialog"
        aria-modal="true"
        aria-label={t('新建任务')}
      >
        <div className="new-task-head">
          <span className="new-task-project-wrap">
            <button
              type="button"
              className="new-task-project"
              aria-haspopup="listbox"
              aria-expanded={projectOpen && rows.length > 0}
              onClick={() => setProjectOpen((value) => !value)}
            >
              <span className="new-task-project-avatar">{projectName.charAt(0).toLowerCase()}</span>
              <span className="new-task-project-name">{projectName}</span>
              <ChevronDown width={12} height={12} />
            </button>
            {/* #176:anchored popover 家族律(#67/#127)——OverlayMount +
                ClickCatcher + Esc;空集不开面(live 无项目时提交走建默认
                项目路径)。选中回填 chip,提交携带 projectId。 */}
            <OverlayMount open={projectOpen && rows.length > 0}>
              <ClickCatcher onClose={() => setProjectOpen(false)} />
              <div className="new-task-project-menu anim-pop" role="listbox" aria-label={t('项目')}>
                {rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="new-task-project-row"
                    role="option"
                    aria-selected={row.id === selected?.id}
                    onClick={() => {
                      setProjectId(row.id);
                      setProjectOpen(false);
                    }}
                  >
                    <span className="new-task-project-row-avatar">
                      {row.name.charAt(0).toLowerCase()}
                    </span>
                    <span className="new-task-project-row-name">{row.name}</span>
                    {row.id === selected?.id && (
                      <span className="new-task-project-check">
                        <Check width={14} height={14} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </OverlayMount>
          </span>
          <div className="new-task-title-label">{t('新建任务')}</div>
          {/* A4-deep 收编：icon 变体皮肤；28×28 + margin-left:auto 几何
              per-face 留 overlay.css。#318 未保存闸:dialog 关闭走
              requestClose(dirty 时先弹确认层)。 */}
          <Button
            variant="icon"
            className="new-task-close"
            aria-label={t('关闭')}
            onClick={requestClose}
          >
            <X />
          </Button>
        </div>
        <div className="new-task-body">
          <input
            ref={inputRef}
            className="new-task-input"
            placeholder={t('需要做什么？')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            ref={specRef}
            className="new-task-spec"
            placeholder={SPEC_TEMPLATE_LINES.map((line) => t(line)).join('\n')}
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
          />
        </div>
        <div className="new-task-footer">
          {/* #309 footer 标签行(r9 96):未选 = 「标签」文本 + 虚线圆添加钮
              (r7 04 基线);已选 = 每标签一枚 TagChip + 添加钮。 */}
          <div className="new-task-tags">
            {selectedTags.length === 0
              ? t('标签')
              : selectedTags.map((tag) => (
                  <TagChip key={tag.id} tag={tag} className="new-task-tag-chip" />
                ))}
            {/* A4-deep 收编：icon 变体皮肤；描边圆环 + dim 墨是 canon 偏差，
                per-face 留 overlay.css（.btn.new-task-tag-add） */}
            <Button
              variant="icon"
              className="new-task-tag-add"
              aria-label={t('添加标签')}
              onClick={() => {
                setProjectOpen(false); // 家族律单实例:两内层不叠
                setTagPanelOpen(true);
              }}
            >
              <PlusSmall />
            </Button>
          </div>
          <div className="new-task-actions">
            {/* A4-deep 收编：icon 变体皮肤；30×30 几何走 .new-task-tools
                button 元素选择器（原样命中） */}
            <div className="new-task-tools">
              {/* #304 C5 裁决:语音输入功能不做(local-first 无语音面)——
                  语音钮移除不渲染,不留死钮;添加附件/提及走 A4 Button 原语。 */}
              <Button variant="icon" aria-label={t('添加附件')}>
                <Paperclip />
              </Button>
              <Button
                variant="icon"
                aria-label={t('提及')}
                onClick={() => setPickerOpen((value) => !value)}
              >
                <Grid2x2 />
              </Button>
            </div>
            <div className="new-task-buttons">
              {/* e2e 别名叠加：integration/test/m5-web-e2e.test.ts 钉
                  .new-task-start（overlays lane 误删致 CI 红，此处恢复；
                  类名与规则无关，纯选择器锚点） */}
              <Button variant="ghost" size="standard" className="new-task-save" onClick={save}>
                {t('保存')}
              </Button>
              <Button
                variant="primary"
                size="standard"
                className="new-task-start"
                disabled={title.trim() === ''}
                onClick={() => {
                  if (onSaveAndStart)
                    onSaveAndStart(title.trim(), selected?.id, selectedTagIds, spec);

                  else save();
                }}
              >
                {t('保存并开始')}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* #309 标签面板(r9 §2.5):448 族 DialogShell,portal 挂 body——
          dialog 的 transform containing block + overflow:hidden 装不下
          viewport 居中面板([设计],家族首个 portal)。pill toggle +
          分隔线 + 「+ 新建标签」内联表单(名称 input + 保存)。 */}
      {createPortal(
        <DialogShell
          className="new-task-tag-panel"
          title={t('标签')}
          open={tagPanelOpen}
          onClose={() => setTagPanelOpen(false)}
        >
          <div className="new-task-tag-body">
            <div className="new-task-tag-pills">
              {tagList.map((tag) => {
                const on = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className="new-task-tag-pill"
                    data-on={on}
                    style={on ? { backgroundColor: tag.color } : undefined}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
            <div className="new-task-tag-divider" />
            {tagFormOpen ? (
              <form
                className="new-task-tag-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitNewTag();
                }}
              >
                <input
                  ref={tagInputRef}
                  className="new-task-tag-input"
                  placeholder={t('标签名称')}
                  value={tagName}
                  onChange={(event) => setTagName(event.target.value)}
                />
                <button
                  type="submit"
                  className="new-task-tag-save"
                  disabled={tagName.trim() === '' || tagCreating}
                >
                  {t('保存')}
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="new-task-tag-new"
                onClick={() => setTagFormOpen(true)}
              >
                <PlusSmall width={12} height={12} />
                {t('新建标签')}
              </button>
            )}
          </div>
        </DialogShell>,
        document.body,
      )}
      {/* #311 mention picker(non-portal,sibling to tag panel).
          Both layers are siblings — Esc/backdrop ordering handled above. */}
      {/* #318 未保存闸确认层(r9 §3.4 copy 逐字):独立层不入 dialog 面板
          ——面板 transform 会吞 fixed 定位(#176 注记同坑);ClickCatcher
          z29 压 dialog z21,外点 = 只收确认层(继续编辑语义),面板 z31 居顶。 */}
      <OverlayMount open={discardOpen}>
        <ClickCatcher onClose={() => setDiscardOpen(false)} />
        <div
          className="new-task-discard anim-fade"
          role="alertdialog"
          aria-modal="true"
          aria-label={t('放弃新建任务？未保存的内容将丢失。')}
        >
          <div className="new-task-discard-title">{t('放弃新建任务？未保存的内容将丢失。')}</div>
          <div className="new-task-discard-actions">
            <button
              type="button"
              className="new-task-discard-keep"
              onClick={() => setDiscardOpen(false)}
            >
              {t('继续编辑')}
            </button>
            <Button
              variant="danger"
              size="standard"
              className="new-task-discard-drop"
              onClick={discardAndClose}
            >
              {t('放弃并关闭')}
            </Button>
          </div>
        </div>
      </OverlayMount>
      <MentionPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        groups={groups}
        onInsert={(tokens) => {
          for (const token of tokens) insertToken(token);
          setPickerOpen(false);
        }}
      />
    </OverlayMount>
  );
}
