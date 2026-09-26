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
// A3-overlays 收编：footer 双钮 = ui/Button（ghost / primary，弹窗语义
// standard 32 档，r7 实测 30 归一到原语三档）；两钮类名无 e2e/parity
// 钉扎，散写规则随收编移除。
//
// M7 #310 附件 wire 改（r9 §3.1）：
//   - spec 受控：live 创建面父持 state，附件 token 才能注入；fixture/静态
//     div 面父不传 spec/onSpecChange → 内部 useState fallback，零行为差
//   - 附件钮 = 原生文件多选触发器，选中文件 → onAttachment(files) 委托
//   - onSave/onSaveAndStart 签名加 spec（之前丢字 bug：spec:textarea 未挂
//     state，提交只把 title 当 spec 用，现修）
// M7 #318 #5 关闭未保存闸（r9 §3.4）：标题/描述/附件/标签任一非空时关闭
// 先过确认——附件 token 注入 spec 后由 spec 非空承载（不另计），标签 add
// 仍为桩（本票不动），dirty = titleTrim !== '' || specTrim !== ''。

import { useEffect, useRef, useState } from 'react';
import { PROJECT_ID, PROJECT_NAME } from '../fixtures/fixtures.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronDown, Grid2x2, Mic, Paperclip, PlusSmall, X } from '../icons/index.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from '../overlays/dismiss.js';
import { Button } from '../ui/button.js';
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

/** fixture 面项目集兜底:scenarios 不带 projectNames 时退 canon 单默认
 *  项目(r3-lifecycle,#176 票面「至少默认项目」)。 */
const DEFAULT_PROJECT: ProjectOption = { id: PROJECT_ID, name: PROJECT_NAME };

interface NewTaskDialogProps {
  /** #73: retained-mount open flag — the exit fade outlives the close. */
  open: boolean;
  onClose: () => void;
  /** #176:提交携带选中项目 id(选择是纯表单 state,无 mutation)。
   *  M7 #310:spec 加入提交 body(r9 §3.1「附件 token 落描述 textarea,随
   *  创建进 spec」——之前 dialog 未挂 spec state,提交用 title 兜底)。 */
  onSave: (title: string, spec: string, projectId?: string) => void;
  /** M5 live 面：保存并开始 = 创建 + POST builds（r2 §4.2 双钮语义）；
   * 缺省 = fixture 行为（同 保存）。M7 #310:同样带 spec。 */
  onSaveAndStart?: (title: string, spec: string, projectId?: string) => void;
  /** M5 live：项目集真值(选择器行数据源);缺省 = fixture canon 单默认
   *  项目(live = projectsQ 投影,fixture = scenario projectNames)。 */
  projects?: ProjectOption[];
  /** M7 #310 受控 spec：live 创建面父持 state,附件 token 才能注入;fixture
   *  面不传 → 内部 useState fallback。 */
  spec?: string;
  onSpecChange?: (next: string) => void;
  /** M7 #310 附件：父组件负责 grant + upload + 拿到 token 后 setSpec 拼
   *  进 spec。父组件在 live 创建面下应同时传 spec/onSpecChange 才能接住。 */
  onAttachment?: (files: File[]) => void | Promise<void>;
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
}: NewTaskDialogProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  // M7 #310 受控 spec：fallback 模式（fixture 静态 div）内部 useState，
  // 父组件未传 spec/onSpecChange 时走 fallback,行为字节不变。
  const [internalSpec, setInternalSpec] = useState('');
  const specControlled = specProp !== undefined && onSpecChange !== undefined;
  const spec = specControlled ? (specProp as string) : internalSpec;
  const setSpec = specControlled
    ? (next: string) => (onSpecChange as (s: string) => void)(next)
    : setInternalSpec;
  // #176 选择器 state:popover 开态 + 选中行。null = 未动,展示/提交取
  // 首行;live 空项目集时 selected 退 undefined(chip 走 canon 名)。
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const rows = projects ?? [DEFAULT_PROJECT];
  const selected = rows.find((row) => row.id === projectId) ?? rows[0];
  const projectName = selected?.name ?? PROJECT_NAME;
  // M7 #310 附件：file picker ref + 上传中 disable 纸夹扣
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attaching, setAttaching] = useState(false);
  // M7 #318 #5 未保存闸：dirty = 标题/描述任一非空。附件 token 注入 spec
  // 后由 spec 非空承载,不另计。标签 add 仍为桩(本票不动)。
  const [confirmOpen, setConfirmOpen] = useState(false);
  const titleDirty = title.trim() !== '';
  const specDirty = spec.trim() !== '';
  const dirty = titleDirty || specDirty;
  const attemptClose = () => {
    if (dirty) setConfirmOpen(true);
    else onClose();
  };
  // Esc 分层:popover 层开时 Esc 只关 popover(dialog 的 Esc 关闸退后一层)
  useEscClose(attemptClose, open && !projectOpen && !confirmOpen);
  useEscapeClose(projectOpen, () => setProjectOpen(false));
  useEscapeClose(confirmOpen, () => setConfirmOpen(false));
  // retained mount:dialog 关闭一并收 popover(重开不得带回开态) + 确认层
  useEffect(() => {
    if (!open) {
      setProjectOpen(false);
      setConfirmOpen(false);
    }
  }, [open]);
  // retained mount means reopen is not a remount — refocus like a fresh one
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // 重置 value 允许同文件再选（change 事件不重发同源）
    e.target.value = '';
    if (files.length === 0 || !onAttachment) return;
    setAttaching(true);
    const result = onAttachment(files);
    void Promise.resolve(result).finally(() => setAttaching(false));
  };
  const save = () => onSave(title.trim(), spec, selected?.id);
  return (
    <OverlayMount open={open} exitMs={FADE_EXIT_MS}>
      <button
        type="button"
        className="overlay-backdrop anim-fade"
        aria-label={t('关闭')}
        onClick={() => {
          // #176 外点内层优先:the dialog's transform: translate(-50%,-50%)
          // shrinks the fixed ClickCatcher's containing block to the panel
          // itself, so clicks outside the panel land here directly — while
          // the project popover is open they must peel the inner layer
          // only (same inner-first law as the Esc split above)
          if (projectOpen) {
            setProjectOpen(false);
            return;
          }
          attemptClose();
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
              per-face 留 overlay.css */}
          <Button
            variant="icon"
            className="new-task-close"
            aria-label={t('关闭')}
            onClick={attemptClose}
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
          <div className="new-task-tags">
            {t('标签')}
            {/* A4-deep 收编：icon 变体皮肤；描边圆环 + dim 墨是 canon 偏差，
                per-face 留 overlay.css（.btn.new-task-tag-add） */}
            <Button variant="icon" className="new-task-tag-add" aria-label={t('添加标签')}>
              <PlusSmall />
            </Button>
          </div>
          <div className="new-task-actions">
            {/* A4-deep 收编：icon 变体皮肤；30×30 几何走 .new-task-tools
                button 元素选择器（原样命中） */}
            <div className="new-task-tools">
              <Button variant="icon" aria-label={t('语音输入')}>
                <Mic />
              </Button>
              <Button
                variant="icon"
                aria-label={t('添加附件')}
                disabled={attaching || !onAttachment}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip />
              </Button>
              <Button variant="icon" aria-label={t('提及')}>
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
                  if (onSaveAndStart) onSaveAndStart(title.trim(), spec, selected?.id);
                  else save();
                }}
              >
                {t('保存并开始')}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* M7 #318 #5 关闭未保存闸（r9 §3.4）：dirty 时先过本确认层；保持
          dialog 整体仍 mounted 让 backdrop 闭态过渡可见。沿用 delete-confirm
          视觉（title + cancel/danger 双钮），类名同前缀做 e2e 别名定位。 */}
      <OverlayMount open={confirmOpen} exitMs={FADE_EXIT_MS}>
        <button
          type="button"
          className="overlay-backdrop anim-fade"
          aria-label={t('关闭')}
          onClick={() => setConfirmOpen(false)}
        />
        <div
          className="delete-confirm anim-fade"
          role="alertdialog"
          aria-modal="true"
          aria-label={t('放弃新建任务？未保存的内容将丢失。')}
        >
          <div className="delete-confirm-head">
            <div className="delete-confirm-title">{t('放弃新建任务？未保存的内容将丢失。')}</div>
            <button
              type="button"
              className="delete-confirm-close"
              aria-label={t('关闭')}
              onClick={() => setConfirmOpen(false)}
            >
              <X />
            </button>
          </div>
          <div className="delete-confirm-actions">
            <Button
              variant="quiet"
              className="delete-confirm-cancel"
              onClick={() => setConfirmOpen(false)}
            >
              {t('取消')}
            </Button>
            <Button
              variant="danger"
              size="standard"
              className="delete-confirm-delete"
              onClick={() => {
                setConfirmOpen(false);
                onClose();
              }}
            >
              {t('放弃')}
            </Button>
          </div>
        </div>
      </OverlayMount>
    </OverlayMount>
  );
}
