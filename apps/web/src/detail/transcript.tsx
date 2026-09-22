// Chat column transcript (issue #56, r5b §3.8 / r7 16/17; CONTEXT.md canon
// names the message flow `transcript`): centered run
// stamp, user bubble + taskline, copy/restore icon pair, robot prose,
// collapsed plan card with clamped preview and the 完成 Ns row, and the
// live planning row (avatar + Ns + › + step label).

import type { TranscriptItem } from '../fixtures/records.js';
import { ChevronRight, Copy, ExternalLink, FileTab, History, Restore } from '../icons/index.js';

interface TranscriptProps {
  transcript: TranscriptItem[];
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
    case 'user':
      return (
        <>
          <div className="chat-row">
            <span className="chat-avatar">
              <img src="/avatar-user.png" alt="" />
            </span>
            <span className="chat-bubble">{item.text}</span>
          </div>
          <div className="chat-taskline">
            <span className="chat-taskline-seq">#{item.seq}</span>
            <span className="chat-taskline-title">{item.title}</span>
          </div>
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
          <span className="chat-text">{item.text}</span>
        </div>
      );
    case 'streaming':
      return (
        <div className="chat-row chat-row--agent">
          <span className="chat-avatar">
            <img src="/avatar-robot-1.svg" alt="" />
          </span>
          <span className="chat-streaming">
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
          <div className="chat-done">
            <History width={15} height={15} />
            完成 {item.seconds}s
          </div>
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
