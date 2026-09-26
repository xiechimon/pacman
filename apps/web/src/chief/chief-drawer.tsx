// Chief drawer (issue #72): the right-anchored floating panel over the
// board (r5 100/111/114/116: 418 wide, top 42, right 17, bottom 16, radius
// 12). Header = thread chip + model slot + icon buttons; body = gate bar
// (unbound) or hero examples / thread message flow; composer pinned at the
// bottom. The switcher popover (116) and the view swap to 总管设置 are real
// state so the surface is clickable in dev; parity captures never click, so
// the fixture alone decides the captured state.
//
// #146 收尾：Esc 关面板（useEscapeClose 弹层族同律——内层的线程切换器
// popover 先关，再关 drawer）；hero 快捷提示 ×4 点击即发预置词进 chief
// 线程（live 面 onSend，等同键入发送；fixture 面与发送钮同款惰性）；头部
// 「新主题」落回新线程视图（live）、「全屏」切面板形态（纯 UI 态，双面
// 可用；全窗形态无任一批次抓拍——r2 §9-26 `tds.panel-maximized` 未点开、
// r8-chief-panel-adhoc §3——几何 [推断]：充满定位容器、圆角归零）。
// composer 行只保留发送钮：语音输入/添加附件/提及为 local-first 无后端面，
// 裁决隐藏不渲染（#136 台账 wontfix，理由登记在该票评论区）。
// #306 wontfix 出账：r8 随拍在线程视图头部多出的「更多」（⋮）钮——原站
// 菜单内容从未点开无正典（r8-chief-panel-adhoc §3），pacman server chief
// 面亦无线程管理 mutation（GET/POST threads 外无删除/重命名端点），无
// local-first 对象面，按 M7 处置二分律移除不渲染；头部四钮双视图同律。

import { useState } from 'react';
import type { ChiefContent, ChiefSegment } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import {
  ArrowUp,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ChiefExpand,
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
  Restore,
  X,
} from '../icons/index.js';
import { DRAWER_EXIT_MS } from '../overlay/use-overlay-mount.js';
import { OverlayMount, useEscapeClose } from '../overlays/dismiss.js';
import './chief.css';

const EXAMPLE_ICONS = {
  'user-plus': ChiefUserPlus,
  folder: ChiefFolder,
  grid: Grid2x2,
  bars: BarChart3,
} as const;

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
  /** Opens the 总管设置 content swap — a board-route affordance (r5
   *  101–104); absent hides the gear (the shared wake surfaces, #129). */
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
}

export function ChiefDrawer({
  chief,
  open = true,
  onSettings,
  onClose,
  onSend,
  onThread,
  onNewThread,
}: DrawerProps) {
  const { t } = useI18n();
  const [threadsOpen, setThreadsOpen] = useState(chief.threadsOpen ?? false);
  const [liveDraft, setLiveDraft] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const draftValue = onSend != null ? liveDraft : (chief.draft ?? '');
  // #146: Esc 与弹层族同律（#127 useEscapeClose 先例）——最内层先关：
  // 线程切换器 popover 开着时第一下 Esc 收 popover，第二下关 drawer。
  useEscapeClose(open, () => {
    if (threadsOpen) setThreadsOpen(false);
    else onClose();
  });
  const sendLive = () => {
    if (onSend == null || liveDraft.trim() === '') return;
    onSend(liveDraft.trim());
    setLiveDraft('');
  };
  return (
    <OverlayMount open={open} exitMs={DRAWER_EXIT_MS}>
      <aside
        className={
          fullscreen ? 'chief-drawer anim-drawer is-fullscreen' : 'chief-drawer anim-drawer'
        }
        aria-label={t('总管')}
      >
        <header className="chief-head">
          <div className="chief-head-row">
            <button
              type="button"
              className="chief-chip"
              aria-label={t('主题')}
              onClick={() => setThreadsOpen((v) => !v)}
            >
              <ChiefHash />
              <span className="chief-chip-title">{t(chief.threadTitle)}</span>
              <ChevronDown width={12} height={12} />
            </button>
            <div className="chief-head-actions">
              <button
                type="button"
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
              </button>
              {onSettings != null && (
                <button type="button" aria-label={t('总管设置')} onClick={onSettings}>
                  <ChiefGear />
                </button>
              )}
              <button
                type="button"
                aria-label={fullscreen ? t('退出全屏') : t('全屏')}
                aria-pressed={fullscreen}
                onClick={() => setFullscreen((v) => !v)}
              >
                <ChiefExpand />
              </button>
              <button type="button" aria-label={t('关闭')} onClick={onClose}>
                <X width={16} height={16} />
              </button>
            </div>
          </div>
          <div className="chief-model">
            {chief.bound ? (
              <>
                <ChiefPi />
                <span>{chief.modelSlot}</span>
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
              <button type="button" className="chief-gate-btn" onClick={onSettings}>
                {t('设置')}
              </button>
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
                    <button
                      type="button"
                      className="chief-example"
                      key={ex.text}
                      onClick={onSend != null ? () => onSend(ex.text) : undefined}
                    >
                      <span className="chief-example-tile">
                        <Icon width={14} height={14} />
                      </span>
                      <span className="chief-example-text">{t(ex.text)}</span>
                    </button>
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
                          <Copy width={13} height={13} />
                          <Restore width={13} height={13} />
                        </div>
                      </div>
                    </div>
                  );
                return (
                  <div key={i} className="chief-msg">
                    <ChiefFaceDashed width={24} height={24} className="chief-avatar" />
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
                        <Copy width={13} height={13} />
                        <span>{t('完成 {n}', { n: item.seconds })}</span>
                        <ChevronRight width={11} height={11} />
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
            className="chief-composer-input"
            rows={onSend != null ? (liveDraft !== '' ? 6 : 1) : chief.draft ? 6 : 1}
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
            <button
              type="button"
              aria-label={t('发送')}
              className={draftValue !== '' ? 'chief-send is-on' : 'chief-send'}
              onClick={sendLive}
            >
              <ArrowUp width={16} height={16} />
            </button>
          </div>
        </div>
      </aside>
    </OverlayMount>
  );
}
