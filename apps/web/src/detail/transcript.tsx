// Chat column transcript (issue #56, extended in #57 for the deep
// states): centered run stamps and dim note lines, the scheduled marker,
// user bubbles with optional taskline, robot paragraphs with mono code
// chips, the collapsed plan card, the live streaming row, the tool-call
// group (collapsed `完成 Ns ▸` / expanded pills + 收起) and the bare
// elapsed row. Row geometry from the r7 16/17/26/27/28/36/38 captures;
// CONTEXT.md canon names the message flow `transcript`.

import type { TranscriptItem } from '../fixtures/records.js';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FileTab,
  History,
  Restore,
  Terminal,
} from '../icons/index.js';
import { Segments } from './segments.js';

interface TranscriptProps {
  transcript: TranscriptItem[];
}

/** Elapsed label: `Ns` under a minute (r7 21s/19s), `Nm Ns` above
 *  (r8 56 plan card `完成 2m 41s`). */
function formatElapsed(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** `完成 Ns` row with the history glyph — shared by the plan card, the
 *  tool group header (chevron appended) and the bare elapsed row (solo =
 *  standalone, wider top margin). */
function ElapsedRow({
  seconds,
  expanded,
  solo,
}: {
  seconds: number;
  expanded?: boolean;
  solo?: boolean;
}) {
  return (
    <div className={solo ? 'chat-done chat-done--solo' : 'chat-done'}>
      <History width={15} height={15} />
      <span className="chat-done-label">
        完成 {formatElapsed(seconds)}
        {expanded != null &&
          (expanded ? (
            <ChevronDown width={10} height={10} />
          ) : (
            <ChevronRight width={10} height={10} />
          ))}
      </span>
    </div>
  );
}

function Row({ item }: { item: TranscriptItem }) {
  switch (item.kind) {
    case 'run':
      return (
        <div className="chat-stamp">
          <div>{item.at}</div>
          <div className="chat-stamp-machine">
            运行在 <span>{item.machine}</span> 上
          </div>
        </div>
      );
    case 'note':
      return <div className="chat-note">{item.text}</div>;
    case 'scheduled':
      return (
        <div className="chat-scheduled">
          <Clock width={13} height={13} />
          由定时发起
        </div>
      );
    case 'user':
      return (
        <>
          <div className="chat-row">
            <span className="chat-avatar">
              <img src="/avatar-user.png" alt="" />
            </span>
            <span className="chat-bubble">{item.text}</span>
          </div>
          {item.seq != null && item.title != null && (
            <div className="chat-taskline">
              <span className="chat-taskline-seq">#{item.seq}</span>
              <span className="chat-taskline-title">{item.title}</span>
            </div>
          )}
          <div className="chat-row-icons">
            <Copy width={13} height={13} />
            <Restore width={13} height={13} />
          </div>
        </>
      );
    case 'robot':
      return (
        <div className="chat-row chat-row--agent">
          <span className="chat-avatar">
            <img src="/avatar-robot-1.svg" alt="" />
          </span>
          <span className="chat-text">
            {item.paragraphs.map((para, i) => (
              // fixture order is stable; paragraphs carry no ids
              <p key={i} className="chat-para">
                <Segments segments={para} codeClassName="chat-code" />
              </p>
            ))}
          </span>
        </div>
      );
    case 'streaming':
      return (
        <div className="chat-row chat-row--agent">
          <span className="chat-avatar">
            <img src="/avatar-robot-1.svg" alt="" />
          </span>
          <span className="chat-streaming">
            {/* frozen braille spinner frame before the elapsed seconds
                (r7 16/26/26d rows all show it) */}
            <span className="chat-spinner">⠙</span>
            {item.seconds}s
            <ChevronRight width={10} height={10} />
            <span className="chat-streaming-label">{item.label}</span>
          </span>
        </div>
      );
    case 'plan':
      return (
        <>
          <div className="chat-plan">
            <FileTab width={14} height={14} />
            <span className="chat-plan-title">{item.title}</span>
            <span className="chat-plan-open">
              <ExternalLink width={12} height={12} />
            </span>
          </div>
          <div className="chat-preview">{item.preview}</div>
          <ElapsedRow seconds={item.seconds} />
        </>
      );
    case 'tools':
      return (
        <>
          <ElapsedRow seconds={item.seconds} expanded={item.expanded} />
          {item.expanded && (
            <>
              <div className="chat-tools">
                {item.pills.map((pill) => (
                  <div key={pill} className="chat-tool-pill">
                    <Terminal width={12} height={12} />
                    <span className="chat-tool-label">{pill}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="chat-collapse">
                收起
                <ChevronDown width={10} height={10} className="chat-collapse-icon" />
              </button>
            </>
          )}
        </>
      );
    case 'elapsed':
      return <ElapsedRow seconds={item.seconds} solo />;
  }
}

export function Transcript({ transcript }: TranscriptProps) {
  return (
    <>
      {transcript.map((item, i) => (
        // fixture order is stable; items carry no ids
        <Row key={i} item={item} />
      ))}
    </>
  );
}
