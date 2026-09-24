// Chief drawer (issue #72): the right-anchored floating panel over the
// board (r5 100/111/114/116: 418 wide, top 42, right 17, bottom 16, radius
// 12). Header = thread chip + model slot + icon buttons; body = gate bar
// (unbound) or hero examples / thread message flow; composer pinned at the
// bottom. The switcher popover (116) and the view swap to 总管设置 are real
// state so the surface is clickable in dev; parity captures never click, so
// the fixture alone decides the captured state.

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
  EllipsisVertical,
  FileText,
  Grid2x2,
  Mic,
  Paperclip,
  Plus,
  Restore,
  X,
} from '../icons/index.js';
import { DRAWER_EXIT_MS } from '../overlay/use-overlay-mount.js';
import { OverlayMount } from '../overlays/dismiss.js';
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
}

export function ChiefDrawer({
  chief,
  open = true,
  onSettings,
  onClose,
  onSend,
  onThread,
}: DrawerProps) {
  const { t } = useI18n();
  const [threadsOpen, setThreadsOpen] = useState(chief.threadsOpen ?? false);
  const [liveDraft, setLiveDraft] = useState('');
  const hasThread = chief.stream != null;
  const draftValue = onSend != null ? liveDraft : (chief.draft ?? '');
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
              <button type="button" aria-label={t('新主题')}>
                <Plus width={18} height={18} />
              </button>
              {onSettings != null && (
                <button type="button" aria-label={t('总管设置')} onClick={onSettings}>
                  <ChiefGear />
                </button>
              )}
              {hasThread && (
                <button type="button" aria-label={t('更多')}>
                  <EllipsisVertical width={16} height={16} />
                </button>
              )}
              <button type="button" aria-label={t('全屏')}>
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
                    <button type="button" className="chief-example" key={ex.text}>
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
            <button type="button" aria-label={t('语音输入')}>
              <Mic width={18} height={18} />
            </button>
            <button type="button" aria-label={t('添加附件')}>
              <Paperclip width={18} height={18} />
            </button>
            <button type="button" aria-label={t('提及')}>
              <Grid2x2 width={16} height={16} />
            </button>
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
