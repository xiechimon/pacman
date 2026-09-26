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
// #318 未保存闸 (r9 §3.4): 标题/描述任一非空时,三条关闭路径(X / backdrop /
// Esc)先过「放弃新建任务？未保存的内容将丢失。」确认弹层(继续编辑 / 放弃
// 并关闭);净表单直关不闸。Esc 分层沿 #176 内层优先律(确认层 → 项目
// popover → dialog)。附件/标签的 dirty 位归 #309/#310 接线时扩展。
// 关闭即重置表单(retained-mount 重开 = 净面,闸判定不带脏残留)。

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
  /** #176:提交携带选中项目 id(选择是纯表单 state,无 mutation)。 */
  onSave: (title: string, projectId?: string) => void;
  /** M5 live 面：保存并开始 = 创建 + POST builds（r2 §4.2 双钮语义）；
   * 缺省 = fixture 行为（同 保存）。 */
  onSaveAndStart?: (title: string, projectId?: string) => void;
  /** M5 live：项目集真值(选择器行数据源);缺省 = fixture canon 单默认
   *  项目(live = projectsQ 投影,fixture = scenario projectNames)。 */
  projects?: ProjectOption[];
}

export function NewTaskDialog({
  open,
  onClose,
  onSave,
  onSaveAndStart,
  projects,
}: NewTaskDialogProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  // #318: 描述入受控(闸的 dirty 判定源;placeholder 模板行不变)
  const [spec, setSpec] = useState('');
  // #318 未保存闸确认层开态
  const [discardOpen, setDiscardOpen] = useState(false);
  // #176 选择器 state:popover 开态 + 选中行。null = 未动,展示/提交取
  // 首行;live 空项目集时 selected 退 undefined(chip 走 canon 名)。
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const rows = projects ?? [DEFAULT_PROJECT];
  const selected = rows.find((row) => row.id === projectId) ?? rows[0];
  const projectName = selected?.name ?? PROJECT_NAME;
  // #318: 附件/标签尚无表单 state(#309/#310 接线时并入 dirty 位)
  const dirty = title.trim() !== '' || spec.trim() !== '';
  const requestClose = () => {
    if (dirty) setDiscardOpen(true);
    else onClose();
  };
  // Esc 分层(#318 三层,内层优先):确认层 → 项目 popover → dialog 关闸
  useEscClose(requestClose, open && !projectOpen && !discardOpen);
  useEscapeClose(projectOpen, () => setProjectOpen(false));
  useEscapeClose(discardOpen, () => setDiscardOpen(false));
  // retained mount:dialog 关闭一并收 popover + 确认层,并重置表单
  // (重开不得带回开态/脏字——闸判定以净面起步)
  useEffect(() => {
    if (!open) {
      setProjectOpen(false);
      setDiscardOpen(false);
      setTitle('');
      setSpec('');
    }
  }, [open]);
  // retained mount means reopen is not a remount — refocus like a fresh one
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  const save = () => onSave(title.trim(), selected?.id);
  // #318 放弃并关闭:清表单 + 关 dialog(父收 open,重置 effect 兜底同律)
  const discardAndClose = () => {
    setDiscardOpen(false);
    setTitle('');
    setSpec('');
    onClose();
  };
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
          <button
            type="button"
            className="new-task-close"
            aria-label={t('关闭')}
            onClick={requestClose}
          >
            <X />
          </button>
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
        </div>
        <div className="new-task-footer">
          <div className="new-task-tags">
            {t('标签')}
            <button type="button" className="new-task-tag-add" aria-label={t('添加标签')}>
              <PlusSmall />
            </button>
          </div>
          <div className="new-task-actions">
            <div className="new-task-tools">
              <button type="button" aria-label={t('语音输入')}>
                <Mic />
              </button>
              <button type="button" aria-label={t('添加附件')}>
                <Paperclip />
              </button>
              <button type="button" aria-label={t('提及')}>
                <Grid2x2 />
              </button>
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
                  if (onSaveAndStart) onSaveAndStart(title.trim(), selected?.id);
                  else save();
                }}
              >
                {t('保存并开始')}
              </Button>
            </div>
          </div>
        </div>
      </div>
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
    </OverlayMount>
  );
}
