// New-task dialog (issue #66, r7 04/14; spec 15 #394 改造): 672×439 centered
// modal over the board. Head = project chip + centered 新建任务 + close;
// body = 单字段正文 textarea（无标题输入——保存时 server 落占位标题 = 正文
// 首行截断，执行 agent 接单后经 set_task_meta 回填正式标题，ADR 0002）；
// footer = composer-style toolbar + 保存 / 保存并开始（闸 = 正文非空）。
// #176: the project chip is a selector — click opens an anchored popover
// (family law #67/#127: OverlayMount + ClickCatcher + Esc, dhead chip
// popover precedent), rows = the project set (live = useProjects truth;
// fixture = scenario projectNames / canon default), selection is pure
// form state that backfills the chip and rides the submit's projectId.
// A3-overlays 收编：footer 双钮 = ui/Button（ghost / primary，弹窗语义
// standard 32 档，r7 实测 30 归一到原语三档）。
//
// M7 #310 附件 wire（r9 §3.1）：
//   - spec 受控：live 创建面父持 state，附件 token 才能注入；fixture/静态
//     div 面父不传 spec/onSpecChange → 内部 useState fallback，零行为差
//   - 附件钮 = 原生文件多选触发器，选中文件 → onAttachment(files) 委托
// #311: spec textarea now owns state + the 提及 button opens the same
// MentionPicker the composer uses. Mention tokens land at the spec
// caret position via insertMentionText — the spec rides along to the
// createTodo body unchanged, and the rendering side (Segments) parses
// them back into chips when the description is shown later.
// #318 未保存闸 (r9 §3.4): 正文非空时,三条关闭路径(X / backdrop /
// Esc)先过「放弃新建任务？未保存的内容将丢失。」确认弹层(继续编辑 / 放弃
// 并关闭);净表单直关不闸。Esc 分层沿 #176 内层优先律(确认层 → 提及
// picker → 项目 popover → dialog)。关闭即重置表单(retained-mount 重开 =
// 净面,闸判定不带脏残留)。#394 起 dirty = 正文单字段（标题/标签面移除）。

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { PROJECT_ID, PROJECT_NAME } from '../fixtures/fixtures.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronDown, Grid2x2, Paperclip, X } from '../icons/index.js';
import { ClickCatcher, OverlayMount } from '../overlays/dismiss.js';
import { type MentionGroups, MentionPicker } from './mention-picker.js';
import { insertMentionText, type MentionToken } from './mention-token.js';
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

/** fixture 面项目集兜底:scenarios 不带 projectNames 时退 canon 单默认
 *  项目(r3-lifecycle,#176 票面「至少默认项目」)。 */
const DEFAULT_PROJECT: ProjectOption = { id: PROJECT_ID, name: PROJECT_NAME };

export interface NewTaskDialogProps {
  /** #73: retained-mount open flag — the exit fade outlives the close. */
  open: boolean;
  onClose: () => void;
  /** spec 15 #394:提交 = 正文 + 选中项目 id（无标题/标签——标题 server 派生
   *  占位、agent 回填；标签固定词表由 agent 归类）。
   *  #311：spec 参数携带 mention token 内容——父级负责透传到
   *  createTodo body。 */
  onSave: (spec: string, projectId?: string) => void;
  /** M5 live 面：保存并开始 = 创建 + POST builds（r2 §4.2 双钮语义）；
   * 缺省 = fixture 行为（同 保存）。 */
  onSaveAndStart?: (spec: string, projectId?: string) => void;
  /** M5 live：项目集真值(选择器行数据源);缺省 = fixture canon 单默认
   * 项目(live = projectsQ 投影,fixture = scenario projectNames)。 */
  projects?: ProjectOption[];
  /** M7 #310 受控 spec：live 创建面父持 state,附件 token 才能注入;fixture
   * 面不传 → 内部 useState fallback。 */
  spec?: string;
  onSpecChange?: (next: string) => void;
  /** M7 #310 附件：父组件负责 grant + upload + 拿到 token 后 setSpec 拼
   * 进 spec。父组件在 live 创建面下应同时传 spec/onSpecChange 才能接住。 */
  onAttachment?: (files: File[]) => void | Promise<void>;

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
  spec: specProp,
  onSpecChange,
  onAttachment,

  mentionGroups,
}: NewTaskDialogProps) {
  const { t } = useI18n();
  // M7 #310 受控 spec：fallback 模式（fixture 静态 div）内部 useState，
  // 父组件未传 spec/onSpecChange 时走 fallback,行为字节不变。
  const [internalSpec, setInternalSpec] = useState('');
  const specControlled = specProp !== undefined && onSpecChange !== undefined;
  const spec = specControlled ? (specProp as string) : internalSpec;
  const setSpec: React.Dispatch<React.SetStateAction<string>> = specControlled
    ? (next) =>
        (onSpecChange as (s: string) => void)(typeof next === 'function' ? next(spec) : next)
    : setInternalSpec;
  // #311 mention picker
  const [pickerOpen, setPickerOpen] = useState(false);
  // #318 未保存闸确认层开态
  const [discardOpen, setDiscardOpen] = useState(false);
  // #176 选择器 state:popover 开态 + 选中行。null = 未动,展示/提交取
  // 首行;live 空项目集时 selected 退 undefined(chip 走 canon 名)。
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  // M7 #310 附件：file picker ref + 上传中 disable 纸夹扣
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attaching, setAttaching] = useState(false);
  const rows = projects ?? [DEFAULT_PROJECT];
  const selected = rows.find((row) => row.id === projectId) ?? rows[0];
  const projectName = selected?.name ?? PROJECT_NAME;
  // #318: 附件 token 注入 spec 后由 spec 非空承载 dirty,不另计。

  const dirty = spec.trim() !== '';
  // #389 硬化（叠加在 #394 的 effect 归还之上）：用户发起的关闭路径同步
  // 归还——effect 归还在负载下可滞后于紧随的断言读（overlay-focus 批跑
  // 实测 race）。脏表单只开确认层（dialog 不关，焦点不还）。
  const returnFocusToInvoker = () => {
    const el = returnFocusRef.current;
    returnFocusRef.current = null;
    if (el && el !== document.body && document.contains(el)) el.focus();
  };
  const requestClose = () => {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    returnFocusToInvoker();
    onClose();
  };
  // Esc 分层 4 层(内层优先):确认层 → 提及 picker → 项目 popover → dialog 关闸
  // (合并 #311 picker + #318 闸;discardOpen/pickerOpen 由各自 ClickCatcher
  // / useEscapeClose 单独处理,这里只控 dialog 自身的 Esc 关闸。)
  // retained mount:dialog 关闭一并收 popover(重开不得带回开态) + 确认层
  // + picker,并重置表单(重开不得带回开态/脏字——闸判定以净面起步)
  useEffect(() => {
    if (!open) {
      setProjectOpen(false);
      setDiscardOpen(false);
      setPickerOpen(false);
      setSpec('');
    }
  }, [open]);
  // retained mount：关闭退场后子树卸载,重开 = 重新挂载。autofocus 挂 ref
  // callback（挂载瞬间触发,绕过 OverlayMount 的 effect 时序——首开时
  // 对话框 effect 早于子树挂载,effect 里聚焦会打空）。useCallback 稳定
  // 引用 = 输入期重渲染不重复触发（同元素同 ref 不重逢）。
  const specRef = useRef<HTMLTextAreaElement | null>(null);
  const focusSpecRef = useCallback((el: HTMLTextAreaElement | null) => {
    specRef.current = el;
    el?.focus();
  }, []);
  // 焦点归还（#388 族律）：开时记下触发元素,关时归还——正文 textarea 随
  // 退场卸载,不归还会掉回 body（键盘用户丢失上下文;overlay-focus e2e 的
  // Esc 后环断言依赖焦点回到触发钮）。
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      return;
    }
    returnFocusToInvoker();
  }, [open]);

  // M7 #310 附件选择回调：files → onAttachment 委托父处理 grant+upload+
  // setSpec 拼 token；reset value 允许同文件再选（change 事件不重发同源）
  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0 || !onAttachment) return;
    setAttaching(true);
    const result = onAttachment(files);
    void Promise.resolve(result).finally(() => setAttaching(false));
  };

  // spec 15 #394: 提交 = 正文 + 项目 id；标题位随输入框一并退役。
  const save = () => onSave(spec, selected?.id);

  // #318 放弃并关闭:清表单 + 关 dialog(父收 open,重置 effect 兜底同律)
  const discardAndClose = () => {
    setDiscardOpen(false);
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
    <>
      <DialogShell
        bare
        open={open}
        onClose={requestClose}
        // 外点内层优先（旧 backdrop 上的三分支逻辑）：项目浮层 / 提及 picker
        // 开着先关内层；discard 层由它自己的底座接管；剩余走未保存闸。
        onBackdropClick={() => {
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
        // #318 分层 Esc（旧壳四处 useEscClose 的合并）：内层开着时壳不关自己，
        // 由本回调按层序收最上面那层；全关时壳自己走 requestClose（未保存闸）。
        // mention picker 已换 FloatingShell（Base UI 嵌套顶层，escapeKey:
        // isTopmost 自己收），故本闸只覆盖仍走仓内 OverlayMount 的两层。
        onEscapeWhileNested={
          projectOpen || discardOpen
            ? () => {
                if (projectOpen) setProjectOpen(false);
                else setDiscardOpen(false);
              }
            : undefined
        }
        // zIndex 21：仓内浮层阶梯（面板 21 < ClickCatcher 29 < 确认层 31）——
        // 缺省 50 会压住本文件的 discard 确认层，故按旧值下移
        zIndex={21}
        className="new-task-dialog"
        width={672}
        height={439}
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
            variant="ghost"
            size="icon"
            className="new-task-close"
            aria-label={t('关闭')}
            onClick={requestClose}
          >
            <X />
          </Button>
        </div>
        <div className="new-task-body">
          {/* spec 15 #394：单字段正文——标题输入位移除,占位提示 = 五行模板族
              （首行即任务一句话,占位标题派生取它）。 */}
          <textarea
            ref={focusSpecRef}
            className="new-task-spec"
            placeholder={SPEC_TEMPLATE_LINES.map((line) => t(line)).join('\n')}
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
          />
          {/* M7 #310 附件：原生文件多选触发器；选中文件 → onAttachment(files)
              委托父处理 grant+upload+setSpec 拼 token；accept 与 server
              ALLOWED_MIME_* 镜像（OS 文件选择器仍可越界,最终 server 强拒兜底） */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={onPickFiles}
            accept="text/*,image/*,application/json,application/pdf,application/xml"
          />
        </div>
        <div className="new-task-footer">
          <div className="new-task-actions">
            {/* A4-deep 收编：icon 变体皮肤；30×30 几何走 .new-task-tools
                button 元素选择器（原样命中） */}
            <div className="new-task-tools">
              {/* #304 C5 裁决:语音输入功能不做(local-first 无语音面)——
                  语音钮移除不渲染,不留死钮;添加附件/提及走 A4 Button 原语。 */}
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('添加附件')}
                disabled={attaching || !onAttachment}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip />
              </Button>
              <Button
                variant="ghost"
                size="icon"
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
              <Button
                variant="ghost"
                size="default"
                className="new-task-save"
                disabled={spec.trim() === ''}
                onClick={save}
              >
                {t('保存')}
              </Button>
              <Button
                variant="brand"
                size="default"
                className="new-task-start"
                disabled={spec.trim() === ''}
                onClick={() => {
                  if (onSaveAndStart) onSaveAndStart(spec, selected?.id);
                  else save();
                }}
              >
                {t('保存并开始')}
              </Button>
            </div>
          </div>
        </div>
      </DialogShell>
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
              variant="destructive"
              size="default"
              className="new-task-discard-drop"
              onClick={discardAndClose}
            >
              {t('放弃并关闭')}
            </Button>
          </div>
        </div>
      </OverlayMount>
      {/* #311 mention picker(sibling layer)。Esc/backdrop 顺序见上分层注记。 */}
      <MentionPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        groups={groups}
        onInsert={(tokens) => {
          for (const token of tokens) insertToken(token);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
