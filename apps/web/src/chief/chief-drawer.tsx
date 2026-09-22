// Chief drawer (issue #72): the right-anchored floating panel over the
// board (r5 100/111/114/116: 418 wide, top 42, right 17, bottom 16, radius
// 12). Header = thread chip + model slot + icon buttons; body = gate bar
// (unbound) or hero examples / thread message flow; composer pinned at the
// bottom. The switcher popover (116) and the view swap to 总管设置 are real
// state so the surface is clickable in dev; parity captures never click, so
// the fixture alone decides the captured state.

import { useState } from 'react';
import type { ChiefContent, ChiefSegment } from '../fixtures/records.js';
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
  Copy,
  EllipsisVertical,
  FileText,
  Grid2x2,
  Mic,
  Paperclip,
  Plus,
  Restore,
  UserCircle,
  X,
} from '../icons/index.js';
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
            // eslint-disable-next-line react/no-array-index-key
            <span key={i} className="chief-chip-todo">
              <FileText width={11} height={11} />
              {s.todo}
            </span>
          );
        if (s.agent != null)
          return (
            // eslint-disable-next-line react/no-array-index-key
            <span key={i} className="chief-chip-agent">
              <ChiefFaceDashed width={11} height={11} />
              {s.agent}
            </span>
          );
        if (s.code)
          return (
            // eslint-disable-next-line react/no-array-index-key
            <code key={i} className="chief-code">
              {s.text}
            </code>
          );
        return s.strong ? (
          // eslint-disable-next-line react/no-array-index-key
          <strong key={i}>{s.text}</strong>
        ) : (
          // eslint-disable-next-line react/no-array-index-key
          <span key={i}>{s.text}</span>
        );
      })}
    </>
  );
}

interface DrawerProps {
  chief: ChiefContent;
  onSettings: () => void;
  onClose: () => void;
}

export function ChiefDrawer({ chief, onSettings, onClose }: DrawerProps) {
  const [threadsOpen, setThreadsOpen] = useState(chief.threadsOpen ?? false);
  const hasThread = chief.stream != null;
  return (
    <aside className="chief-drawer" aria-label="总管">
      <header className="chief-head">
        <div className="chief-head-row">
          <button
            type="button"
            className="chief-chip"
            aria-label="主题"
            onClick={() => setThreadsOpen((v) => !v)}
          >
            <ChiefHash />
            <span className="chief-chip-title">{chief.threadTitle}</span>
            <ChevronDown width={12} height={12} />
          </button>
          <div className="chief-head-actions">
            <button type="button" aria-label="新主题">
              <Plus width={18} height={18} />
            </button>
            <button type="button" aria-label="总管设置" onClick={onSettings}>
              <ChiefGear />
            </button>
            {hasThread && (
              <button type="button" aria-label="更多">
                <EllipsisVertical width={16} height={16} />
              </button>
            )}
            <button type="button" aria-label="全屏">
              <ChiefExpand />
            </button>
            <button type="button" aria-label="关闭" onClick={onClose}>
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
            {(chief.threads ?? []).map((t) => (
              <button
                type="button"
                role="menuitem"
                key={t.title}
                className={t.active ? 'chief-switcher-row is-active' : 'chief-switcher-row'}
              >
                <ChiefHash width={11} height={11} />
                <span>{t.title}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="chief-body">
        {!chief.bound && (
          <div className="chief-gate">
            <span>请先为总管选择一个 Agent。</span>
            <button type="button" className="chief-gate-btn" onClick={onSettings}>
              设置
            </button>
          </div>
        )}
        {chief.examples && (
          <>
            <h2 className="chief-hero">选择一个主题开始</h2>
            <div className="chief-examples">
              {chief.examples.map((ex) => {
                const Icon = EXAMPLE_ICONS[ex.icon];
                return (
                  <button type="button" className="chief-example" key={ex.text}>
                    <span className="chief-example-tile">
                      <Icon width={14} height={14} />
                    </span>
                    <span className="chief-example-text">{ex.text}</span>
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
                  // eslint-disable-next-line react/no-array-index-key
                  <div
                    key={i}
                    className={item.machine ? 'chief-note chief-note-machine' : 'chief-note'}
                  >
                    {item.text}
                  </div>
                );
              if (item.kind === 'user')
                return (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={i} className="chief-msg">
                    <UserCircle width={24} height={24} className="chief-avatar" />
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
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="chief-msg">
                  <ChiefFaceDashed width={24} height={24} className="chief-avatar" />
                  <div className="chief-msg-col">
                    {item.paragraphs.map((p, j) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <p key={j} className="chief-para">
                        <Segments segments={p} />
                      </p>
                    ))}
                    {item.bullets?.map((b, j) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <p key={`b${j}`} className="chief-bullet">
                        <span className="chief-bullet-dot">•</span>
                        <span>
                          <Segments segments={b} />
                        </span>
                      </p>
                    ))}
                    <div className="chief-msg-foot">
                      <Copy width={13} height={13} />
                      <span>完成 {item.seconds}</span>
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
          rows={chief.draft ? 6 : 1}
          readOnly
          value={chief.draft ?? ''}
          placeholder="有什么可以帮你的？"
        />
        <div className="chief-composer-bar">
          <button type="button" aria-label="语音输入">
            <Mic width={18} height={18} />
          </button>
          <button type="button" aria-label="添加附件">
            <Paperclip width={18} height={18} />
          </button>
          <button type="button" aria-label="提及">
            <Grid2x2 width={16} height={16} />
          </button>
          <button
            type="button"
            aria-label="发送"
            className={chief.draft ? 'chief-send is-on' : 'chief-send'}
          >
            <ArrowUp width={16} height={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
