// Chief drawer (issue #72; panel form re-ruled by #447 / ADR 0004): the
// 总管面板 is a docked right-hand column — 418 wide (the r5 capture value
// kept as the pinned width), full height, flush right, radius 0, no shadow,
// one 1px hairline seam on the left. It is a layout citizen, not an overlay:
// each mount point renders it as the last flex item of a row whose content
// sibling yields (D2). Header = thread chip + model row + icon buttons;
// body = gate bar (unbound) or hero examples / thread message flow;
// composer pinned at the bottom. The switcher popover (116) and the view
// swap to 总管设置 are real state so the surface is clickable in dev;
// fixture captures never click, so the fixture alone decides the captured
// state.
// #615 四连报闭环：模型行由纯显示 span 翻成控制件（button → 主模型覆盖
// dialog，PATCH chief model 槽落库回显）；行首 = 运行时标记（pi 出 π 字形、
// claude-code 出 RUNTIME_LABELS 文字标——用户返工裁决：要运行时 SVG 不要
// Agent 头像；FAB / 消息流的 Agent 头像脸在各自面继续生效）；消息行复制
// glyph 翻真 clipboard 钮（local-first 面存在），恢复/foot 折叠 chevron 无
// 后端面按 #306/#146 二分律移除不渲染；gear 各族可达（非 board 面落 board
// 设置视图深链，ChiefWakePanel 兜底后结构上恒在）。
//
// #146 收尾：Esc 关面板（useEscapeClose 弹层族同律——内层的线程切换器
// popover 先关，再关 drawer）；hero 快捷提示 ×4 点击即发预置词进 chief
// 线程（live 面 onSend，等同键入发送；fixture 面与发送钮同款惰性）；头部
// 「新主题」落回新线程视图（live）。composer 行只保留发送钮：语音输入/
// 添加附件/提及为 local-first 无后端面，裁决隐藏不渲染（#136 台账
// wontfix，理由登记在该票评论区）。
// #306 wontfix 出账：r8 随拍在线程视图头部多出的「更多」（⋮）钮——原站
// 菜单内容从未点开无正典（r8-chief-panel-adhoc §3），pacman server chief
// 面亦无线程管理 mutation（GET/POST threads 外无删除/重命名端点），无
// local-first 对象面，按 M7 处置二分律移除不渲染；头部三钮双视图同律。

import type { ChiefCompactionModel } from '@pacman/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RUNTIME_LABELS } from '../api/mappers.js';
import { Button } from '../components/ui/button.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import type { ChiefContent, ChiefSegment, ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import {
  ArrowUp,
  BarChart3,
  Check,
  ChevronDown,
  ChiefFaceDashed,
  ChiefFolder,
  ChiefGear,
  ChiefHash,
  ChiefPi,
  ChiefUserPlus,
  ChiefUserSolid,
  Copy,
  FileText,
  Grid2x2,
  Plus,
  X,
} from '../icons/index.js';
import { DRAWER_EXIT_MS } from '../overlay/use-overlay-mount.js';
import { OverlayMount, useEscapeClose } from '../overlays/dismiss.js';
import './chief.css';
import { ChiefModelDialog } from './chief-model-dialog.js';

const EXAMPLE_ICONS = {
  'user-plus': ChiefUserPlus,
  folder: ChiefFolder,
  grid: Grid2x2,
  bars: BarChart3,
} as const;

/** Inline runs → plain text（#615 复制钮的 clipboard 载荷：chip 取其label，
 *  代码段取原文——复制的是读者可见文本）。 */
function segmentsText(segments: ChiefSegment[]): string {
  return segments.map((s) => (s.todo != null ? `#${s.todo}` : (s.agent ?? s.text ?? ''))).join('');
}

/** robot 消息全文（#615 foot 复制钮载荷）：段落换行拼接 + bullet 行随附。 */
function robotText(item: { paragraphs: ChiefSegment[][]; bullets?: ChiefSegment[][] }): string {
  const lines = item.paragraphs.map(segmentsText);
  for (const b of item.bullets ?? []) lines.push(`- ${segmentsText(b)}`);
  return lines.join('\n');
}

/** Inline runs: plain text, mono chip, `#N` todo chip, agent chip. */
function Segments({ segments }: { segments: ChiefSegment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        if (s.todo != null)
          return (
            <span key={i} className="chief-chip-todo">
              <FileText width={11} height={11} />
              {s.todo}
            </span>
          );
        if (s.agent != null)
          return (
            <span key={i} className="chief-chip-agent">
              <ChiefFaceDashed width={11} height={11} />
              {s.agent}
            </span>
          );
        if (s.code)
          return (
            <code key={i} className="chief-code">
              {s.text}
            </code>
          );
        return s.strong ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>;
      })}
    </>
  );
}

interface DrawerProps {
  /** #73 retained-mount open flag; the slide-out outlives the close. */
  open?: boolean;
  chief: ChiefContent;
  /** Opens 总管设置: board route = content swap (r5 101–104); the wake
   *  surfaces supply the `?chief=settings` deep-link nav (#615), so the
   *  gear renders on every surface — absent only hides it for callers
   *  that explicitly pass nothing (ChiefWakePanel 兜底后结构上恒在). */
  onSettings?: () => void;
  onClose: () => void;
  /** M5 live 面：composer 可写 + 发送回调（POST chief 线程消息，r5 §3.6）；
   * 缺省 = fixture 静态面（readOnly draft，发送钮惰性）。 */
  onSend?: (text: string) => void;
  /** 主题切换（live 面 threads popover 行点击）。 */
  onThread?: (title: string, index: number) => void;
  /** 新主题（头部 +，#146）：落回新线程视图，下一次发送开新 chief 线程
   * （threadId null = 新主题，wire 注记见 shared chief send schema）；
   * 缺省 = fixture 静态面，钮惰性。 */
  onNewThread?: () => void;
  /** #615 主模型覆盖槽当前值（live = chief 封套真值；null = 继承绑定
   *  Agent）；fixture 面缺省 = null。 */
  modelValue?: ChiefCompactionModel | null;
  /** #615 主模型候选（live = toModelOptions 并集投影）；缺省 = 仅默认行。 */
  modelOptions?: ModelOption[];
  /** #615 live 面：模型 dialog 选定 = PATCH chief model 槽；缺省 = fixture
   *  律（选择即关，零请求）。 */
  onPickModel?: (value: ChiefCompactionModel | null) => void;
}

export function ChiefDrawer({
  chief,
  open = true,
  onSettings,
  onClose,
  onSend,
  onThread,
  onNewThread,
  modelValue = null,
  modelOptions,
  onPickModel,
}: DrawerProps) {
  const { t } = useI18n();
  const [threadsOpen, setThreadsOpen] = useState(chief.threadsOpen ?? false);
  const [modelOpen, setModelOpen] = useState(false);
  // #615 复制钮的瞬时回执：键 = 消息位（u<i> / r<i>），1.5s 后回 Copy 字形。
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyText = (key: string, text: string) => {
    const clip = navigator.clipboard; // 非安全上下文无 clipboard：静默不回执
    if (!clip) return;
    void clip.writeText(text).then(
      () => {
        setCopiedKey(key);
        window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1500);
      },
      () => {},
    );
  };
  const [liveDraft, setLiveDraft] = useState('');
  const draftValue = onSend != null ? liveDraft : (chief.draft ?? '');
  // #146: Esc 与弹层族同律（#127 useEscapeClose 先例）——最内层先关：
  // 线程切换器 popover 开着时第一下 Esc 收 popover，第二下关 drawer。
  useEscapeClose(open, () => {
    if (threadsOpen) setThreadsOpen(false);
    else onClose();
  });
  // #389: 开后焦点落草稿框（dialog 家族 autofocus 律）。OverlayMount 的
  // mounted 滞后 open 一帧（effect 里才 setMounted）——鲜开时 effect 跑在
  // 节点存在之前，故首焦由 ref callback 承载（SearchPanel attachInput
  // 先例）；retained-mount 窗口内重开节点未脱离、ref 不重火，由 [open]
  // effect 兜住。⌘J 热键呼出与 FAB 点击同路。
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const attachComposer = useCallback((node: HTMLTextAreaElement | null) => {
    composerRef.current = node;
    if (node && openRef.current) node.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (open) composerRef.current?.focus({ preventScroll: true });
  }, [open]);
  const sendLive = () => {
    if (onSend == null || liveDraft.trim() === '') return;
    onSend(liveDraft.trim());
    setLiveDraft('');
  };
  return (
    <OverlayMount open={open} exitMs={DRAWER_EXIT_MS}>
      <aside className="chief-drawer anim-drawer" aria-label={t('总管')}>
        <header className="chief-head">
          <div className="chief-head-row">
            {/* XMON-23 收编：ghost 原语 + chief-chip per-face（几何/墨全在
                unlayered per-face，恒压原语层）。中和件：h-auto（原语 h-8
                会撑高 22.5 的行）、leading-[inherit]（原语 text-sm 的定值
                20px 行高会压掉 15px 标题继承的 22.5，像素对拍实测塌 1px）、
                shrink（chip 须收缩让 title 省略号生效）、active 位移、
                svg size-auto（ChiefHash 13px 属性尺寸）。 */}
            <Button
              variant="ghost"
              className="chief-chip h-auto shrink leading-[inherit] active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
              aria-label={t('主题')}
              onClick={() => setThreadsOpen((v) => !v)}
            >
              <ChiefHash />
              <span className="chief-chip-title">{t(chief.threadTitle)}</span>
              <ChevronDown width={12} height={12} />
            </Button>
            <div className="chief-head-actions">
              {/* 头部三钮：同 ghost/icon 收编；20×20 几何由 chief.css 的元素
                  选择器 .chief-head-actions button 承载（仍是 button 元素，
                  规则无改）。 */}
              <Button
                variant="ghost"
                size="icon"
                className="active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
                aria-label={t('新主题')}
                onClick={
                  onNewThread != null
                    ? () => {
                        onNewThread();
                        setThreadsOpen(false);
                      }
                    : undefined
                }
              >
                <Plus width={18} height={18} />
              </Button>
              {onSettings != null && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
                  aria-label={t('总管设置')}
                  onClick={onSettings}
                >
                  <ChiefGear />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
                aria-label={t('关闭')}
                onClick={onClose}
              >
                <X width={16} height={16} />
              </Button>
            </div>
          </div>
          <div className="chief-model">
            {chief.bound ? (
              <>
                {/* #615 A/B：显示行翻控制件——行首 = 绑定 Agent 头像（FAB /
                    消息流同脸，XMON-105 律；未取到 agent 投影退 dashed 字形），
                    点开 = 主模型覆盖 dialog（live PATCH 落库回显）。中和件同
                    头部 chip 族：h-auto/leading-[inherit]/font-normal 防原语
                    定值撑高 12px 行、svg size-auto（ChevronDown 12 属性尺寸）。 */}
                <Button
                  variant="ghost"
                  className="chief-model-btn h-auto shrink leading-[inherit] font-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
                  aria-label={t('总管主模型')}
                  aria-haspopup="dialog"
                  aria-expanded={modelOpen}
                  onClick={() => setModelOpen(true)}
                >
                  {/* #615 返工（用户裁决）：行首 = 运行时标记，不是 Agent 头像
                      ——pi 运行时出 π 字形（ChiefPi，r5 111 模型行 glyph 的再
                      trace）；claude-code 运行时出仓内正本表达 RUNTIME_LABELS
                      文字标（全仓与参考站均无 Claude 商标 SVG，「别新画」边界
                      内不造商标件，登记待裁决）。FAB / 消息流的 Agent 头像脸
                      不受影响（XMON-105 律在其各自面继续生效）。 */}
                  <span className="chief-model-mark">
                    {(chief.modelProvider ?? 'pi') === 'claude-code' ? (
                      <span className="chief-model-runtime-label">
                        {RUNTIME_LABELS['claude-code']}
                      </span>
                    ) : (
                      <ChiefPi width={12} height={12} />
                    )}
                  </span>
                  <span className="chief-model-label">{chief.modelSlot}</span>
                  <ChevronDown width={12} height={12} />
                </Button>
                <ChiefModelDialog
                  open={modelOpen}
                  onClose={() => setModelOpen(false)}
                  value={modelValue}
                  options={modelOptions}
                  onPick={onPickModel}
                />
              </>
            ) : (
              <span>n/a</span>
            )}
          </div>
          {threadsOpen && (
            <div className="chief-switcher" role="menu">
              {(chief.threads ?? []).map((thread, index) => (
                <button
                  type="button"
                  role="menuitem"
                  key={thread.title}
                  className={thread.active ? 'chief-switcher-row is-active' : 'chief-switcher-row'}
                  onClick={
                    onThread != null
                      ? () => {
                          onThread(thread.title, index);
                          setThreadsOpen(false);
                        }
                      : undefined
                  }
                >
                  <ChiefHash width={11} height={11} />
                  <span>{t(thread.title)}</span>
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="chief-body">
          {!chief.bound && (
            <div className="chief-gate">
              <span>{t('请先为总管选择一个 Agent。')}</span>
              {/* XMON-23 收编：brand 档 = A3 primary 等价位（--card-button
                  实底 + on-accent 墨）。中和件对齐 A6 实测形（50×26、12px 字、
                  8px 内边距、8 圆角、400 字重）：h-[26px]/px-2/rounded-md/
                  border-0/font-normal + 既有 inline style；active 位移中和。 */}
              <Button
                variant="brand"
                className="h-[26px] cursor-pointer rounded-md border-0 px-2 font-normal active:not-aria-[haspopup]:translate-y-0"
                style={{ width: 50, fontSize: 12 }}
                onClick={onSettings}
              >
                {t('设置')}
              </Button>
            </div>
          )}
          {chief.examples && (
            <>
              <h2 className="chief-hero">{t('选择一个主题开始')}</h2>
              <div className="chief-examples">
                {chief.examples.map((ex) => {
                  const Icon = EXAMPLE_ICONS[ex.icon];
                  return (
                    // #146: 点击即发预置词进 chief 线程（live 面走 onSend，
                    // 等同用户键入发送；zh 权威 canon 串上行，r5 111 逐字）。
                    // XMON-23 收编：ghost 原语 + chief-example per-face。中和件：
                    // justify-start/whitespace-normal/font-normal（原语居中+
                    // nowrap+medium 会破 170 卡内左对齐换行文案）、active 位移、
                    // svg size-auto（瓦片字形 14px 属性尺寸）。
                    <Button
                      variant="ghost"
                      className="chief-example justify-start whitespace-normal font-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
                      key={ex.text}
                      onClick={onSend != null ? () => onSend(ex.text) : undefined}
                    >
                      <span className="chief-example-tile">
                        <Icon width={14} height={14} />
                      </span>
                      <span className="chief-example-text">{t(ex.text)}</span>
                    </Button>
                  );
                })}
              </div>
            </>
          )}
          {chief.stream && (
            <div className="chief-stream">
              {chief.stream.map((item, i) => {
                if (item.kind === 'note')
                  return (
                    <div key={i} className="chief-note">
                      {t(item.text)}
                      {item.machineName && (
                        <>
                          <span className="chief-machine">{item.machineName}</span>
                          {t('上')}
                        </>
                      )}
                    </div>
                  );
                if (item.kind === 'user')
                  return (
                    <div key={i} className="chief-msg">
                      {/* r5 114/116: the user avatar is a solid filled glyph */}
                      <ChiefUserSolid width={24} height={24} className="chief-avatar" />
                      <div className="chief-msg-col">
                        <div className="chief-bubble">{item.text}</div>
                        <div className="chief-msg-tools">
                          {/* #615 C：复制翻真 clipboard 钮（local-first 面存在）；
                              恢复钮无后端面（chief 无 rewind 端点，#306 注记同
                              律）按二分律移除不渲染，不留死钮。 */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="chief-msg-tool active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
                            aria-label={t('复制')}
                            onClick={() => copyText(`u${i}`, item.text)}
                          >
                            {copiedKey === `u${i}` ? (
                              <Check width={13} height={13} />
                            ) : (
                              <Copy width={13} height={13} />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                return (
                  <div key={i} className="chief-msg">
                    {/* XMON-105: a bound chief answers as its agent — the
                        stream row carries that agent's identity avatar (the
                        same face the FAB chip shows); unbound keeps the
                        dashed chief glyph. */}
                    {chief.bound && chief.agent ? (
                      <span className="chief-avatar chief-avatar--img">
                        <SeededAvatar
                          name={chief.agent.displayName}
                          src={chief.agent.avatarUrl}
                          fallback="/avatar-robot-1.svg"
                        />
                      </span>
                    ) : (
                      <ChiefFaceDashed width={24} height={24} className="chief-avatar" />
                    )}
                    <div className="chief-msg-col">
                      {item.paragraphs.map((p, j) => (
                        <p key={j} className="chief-para">
                          <Segments segments={p} />
                        </p>
                      ))}
                      {item.bullets?.map((b, j) => (
                        <p key={`b${j}`} className="chief-bullet">
                          <span className="chief-bullet-dot">•</span>
                          <span>
                            <Segments segments={b} />
                          </span>
                        </p>
                      ))}
                      <div className="chief-msg-foot">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="chief-msg-tool active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
                          aria-label={t('复制')}
                          onClick={() => copyText(`r${i}`, robotText(item))}
                        >
                          {copiedKey === `r${i}` ? (
                            <Check width={13} height={13} />
                          ) : (
                            <Copy width={13} height={13} />
                          )}
                        </Button>
                        {/* live 面 seconds 空串（mapChiefStream 无耗时数据源）
                            不再渲染空「完成」行；fixture canon 44s 照旧。 */}
                        {item.seconds !== '' && <span>{t('完成 {n}', { n: item.seconds })}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="chief-composer">
          <textarea
            ref={attachComposer}
            className="chief-composer-input"
            readOnly={onSend == null}
            value={draftValue}
            onChange={onSend != null ? (e) => setLiveDraft(e.target.value) : undefined}
            onKeyDown={
              onSend != null
                ? (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendLive();
                    }
                  }
                : undefined
            }
            placeholder={t('有什么可以帮你的？')}
          />
          <div className="chief-composer-bar">
            {/* #146 裁决：语音输入/添加附件/提及 local-first 无后端面——
                隐藏不渲染（#136 台账 wontfix）。 */}
            {/* XMON-23 收编：ghost/icon 原语；实底双态（seg-active/indigo）
                是 canon 偏差，per-face 留 chief.css（.chief-send，选择器已从
                .btn 叠类 re-key——原语不吐 btn 类）。rounded-md = 旧 .btn 的
                8 圆角；border-0 防原语 1px transparent 边 + bg-clip-padding
                在实底外圈切出 1px 缝（像素对拍实测）；active 位移中和；
                ArrowUp 16px = 原语 size-4 同值。 */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('发送')}
              className={
                draftValue !== ''
                  ? 'chief-send is-on rounded-md border-0 active:not-aria-[haspopup]:translate-y-0'
                  : 'chief-send rounded-md border-0 active:not-aria-[haspopup]:translate-y-0'
              }
              onClick={sendLive}
            >
              <ArrowUp width={16} height={16} />
            </Button>
          </div>
        </div>
      </aside>
    </OverlayMount>
  );
}
