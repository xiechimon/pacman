// Chat column transcript (issue #56, extended in #57 for the deep
// states and in #75 for the r8 dynamic states): centered run stamps and
// dim note lines, the scheduled marker, user bubbles with optional
// taskline, robot paragraphs with mono code chips / quote blocks /
// numbered findings, message action rows (copy + optional restore +
// optional `| 完成 Ns` + optional chevron, r7 17/28 + r8 63/65/73), the
// chief-origin marker, the failed-run message (r8 54/73), the collapsed
// plan card, the live streaming row and the tool-call group. Row geometry
// from the r7 16/17/26/27/28/36/38 and r8 54–77 captures; CONTEXT.md canon
// names the message flow `transcript`.

import type { RobotPara, TranscriptItem } from '../fixtures/records.js';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FileTab,
  Restore,
  Terminal,
} from '../icons/index.js';
import { Segments } from './segments.js';

interface TranscriptProps {
  transcript: TranscriptItem[];
}

/** Message action row (r7 17/28, r8 63/65/73): copy icon, optional
 *  restore icon, then the optional `| 完成 Ns` elapsed tail with an
 *  optional trailing chevron. Every footer variant observed is a subset
 *  of this one row. */
function ActionRow({
  restore,
  seconds,
  bare,
  chevron,
}: {
  restore?: boolean;
  seconds?: number;
  /** `完成` with no seconds (reused-plan card, r8 76). */
  bare?: boolean;
  /** `›` on plan cards / collapsed tool groups, `⌄` on expanded ones. */
  chevron?: 'right' | 'down';
}) {
  return (
    <div className="chat-row-icons">
      <Copy width={13} height={13} />
      {restore === true && <Restore width={13} height={13} />}
      {(seconds != null || bare === true) && (
        <span className="chat-foot-elapsed">完成{seconds != null ? ` ${seconds}s` : ''}</span>
      )}
      {chevron === 'right' && <ChevronRight width={10} height={10} className="chat-foot-chevron" />}
      {chevron === 'down' && <ChevronDown width={10} height={10} className="chat-foot-chevron" />}
    </div>
  );
}

function Para({ para }: { para: RobotPara }) {
  if (para.quote === true) {
    return (
      <p className="chat-para chat-para--quote">
        <Segments segments={para.segments} codeClassName="chat-code" />
      </p>
    );
  }
  if (para.ordinal != null) {
    return (
      <p className="chat-para chat-para--num" data-ordinal={para.ordinal}>
        <span className="chat-num-mark">{para.ordinal}.</span>
        <Segments segments={para.segments} codeClassName="chat-code" />
      </p>
    );
  }
  return (
    <p className="chat-para">
      <Segments segments={para.segments} codeClassName="chat-code" />
    </p>
  );
}

function Row({ item }: { item: TranscriptItem }) {
  switch (item.kind) {
    case 'run':
      return (
        <div className="chat-stamp">
          {item.at != null && <div>{item.at}</div>}
          {item.machine != null && (
            <div className="chat-stamp-machine">
              运行在 <span>{item.machine}</span> 上
            </div>
          )}
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
    case 'chief':
      return (
        <div className="chat-row chat-row--chief">
          <span className="chat-avatar">
            <img src="/avatar-robot-2.svg" alt="" />
          </span>
          <span className="chat-chief">由总管发起</span>
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
              <Para key={i} para={para} />
            ))}
          </span>
          {item.footer != null && (
            <ActionRow
              restore={item.footer.restore}
              seconds={item.footer.seconds}
              chevron={item.footer.chevron === true ? 'right' : undefined}
            />
          )}
        </div>
      );
    case 'fail':
      return (
        <div className="chat-row chat-row--agent">
          <span className="chat-avatar">
            <img src="/avatar-robot-1.svg" alt="" />
          </span>
          <span className="chat-text">
            <p className="chat-para chat-para--fail">{item.title}</p>
            <p className="chat-para chat-para--failbody">{item.body}</p>
            <p className="chat-fail-links">
              {item.links.map((link) => (
                <span key={link} className="chat-fail-link">
                  {link}
                </span>
              ))}
            </p>
          </span>
          <ActionRow />
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
          <ActionRow
            seconds={item.seconds}
            bare={item.seconds == null}
            chevron={item.chevron === true ? 'right' : undefined}
          />
        </>
      );
    case 'tools':
      return (
        <>
          <ActionRow seconds={item.seconds} chevron={item.expanded ? 'down' : 'right'} />
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
