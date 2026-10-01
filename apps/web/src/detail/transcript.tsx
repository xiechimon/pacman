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

import { useState } from 'react';
import { inlineSegments } from '../api/mappers.js';
import type { RobotPara, TranscriptItem } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import type { TFunc } from '../i18n/translate.js';
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
import { ChatMarkdown } from './chat-markdown.js';
import { Segments } from './segments.js';

interface TranscriptProps {
  transcript: TranscriptItem[];
  /** #366: the collapsed plan card's open glyph activates the plan
   *  document in the right pane (doc view, plan surface). Absent = the
   *  glyph stays the inert capture form. */
  onOpenPlan?: () => void;
}

/** #471 braille spinner frames: the classic 10-step dot wheel rotated to
 *  open on ⠙ — the frame the r7 26/26d captures froze, which doubles as
 *  the prefers-reduced-motion static frame. The reel turns one 16px slot
 *  per 90ms step (spinner-reel, styles/motion.css). */
const SPINNER_FRAMES = ['⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏', '⠋'];

/** Elapsed label: `Ns` under a minute (r7 21s/19s), `Nm Ns` above
 *  (r8 56 plan card `完成 2m 41s`, #74 dict template). */
function formatElapsed(seconds: number, t: TFunc): string {
  const elapsed = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return t('完成 {elapsed}', { elapsed });
}

/** Message action row (r7 17/28, r8 63/65/73): copy icon, optional
 *  restore icon, then the optional `| 完成 Ns` elapsed tail with an
 *  optional trailing chevron. Every footer variant observed is a subset
 *  of this one row. With `toggle` the row renders as the tool group's
 *  expand/collapse button (#306) instead of a static div. */
function ActionRow({
  restore,
  seconds,
  bare,
  chevron,
  t,
  toggle,
}: {
  restore?: boolean;
  seconds?: number;
  /** `完成` with no seconds (reused-plan card, r8 76). */
  bare?: boolean;
  /** `›` on plan cards / collapsed tool groups, `⌄` on expanded ones. */
  chevron?: 'right' | 'down';
  t: TFunc;
  /** #306: the tools group's footer doubles as the expander (collapsed
   *  r7 27 ↔ expanded 28 family, same law as 全部展开/全部收起). */
  toggle?: { expanded: boolean; onToggle: () => void };
}) {
  const body = (
    <>
      <Copy width={13} height={13} />
      {restore === true && <Restore width={13} height={13} />}
      {(seconds != null || bare === true) && (
        <span className="chat-foot-elapsed">
          {seconds != null ? formatElapsed(seconds, t) : t('完成')}
        </span>
      )}
      {chevron === 'right' && <ChevronRight width={10} height={10} className="chat-foot-chevron" />}
      {chevron === 'down' && <ChevronDown width={10} height={10} className="chat-foot-chevron" />}
    </>
  );
  if (toggle == null) return <div className="chat-row-icons">{body}</div>;
  return (
    <button
      type="button"
      className="chat-row-icons chat-row-icons--toggle"
      aria-expanded={toggle.expanded}
      onClick={toggle.onToggle}
    >
      {body}
    </button>
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

function Row({ item, t, onOpenPlan }: { item: TranscriptItem; t: TFunc; onOpenPlan?: () => void }) {
  switch (item.kind) {
    case 'run':
      return (
        <div className="chat-stamp">
          {item.at != null && <div>{item.at}</div>}
          {item.machine != null && (
            <div className="chat-stamp-machine">
              {t('运行在 {m} 上', { m: item.machine ?? '' })
                .split(item.machine ?? '')
                .map((part, i) =>
                  i === 0 ? (
                    <span key={i}>
                      {part}
                      <span>{item.machine}</span>
                    </span>
                  ) : (
                    <span key={i}>{part}</span>
                  ),
                )}
            </div>
          )}
          {item.cancelled === true && <div className="chat-stamp-cancelled">{t('已取消')}</div>}
        </div>
      );
    case 'note':
      return <div className="chat-note">{item.text}</div>;
    case 'scheduled':
      return (
        <div className="chat-scheduled">
          <Clock width={13} height={13} />
          {t('由定时发起')}
        </div>
      );
    case 'chief':
      return (
        <div className="chat-row chat-row--chief">
          <span className="chat-avatar">
            <img src="/avatar-robot-2.svg" alt="" />
          </span>
          <span className="chat-chief">{t('由总管发起')}</span>
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
            {item.markdown != null ? (
              // #469: block markdown reply — parsed + rendered at render
              // time (headings / nested lists / code fences); inline code
              // chips stay `.chat-code`.
              <ChatMarkdown text={item.markdown} />
            ) : (
              (item.paragraphs ?? []).map((raw, i) => (
                // fixture order is stable; paragraphs carry no ids
                <Para key={i} para={Array.isArray(raw) ? { segments: raw } : raw} />
              ))
            )}
          </span>
          {item.footer != null && (
            <ActionRow
              restore={item.footer.restore}
              seconds={item.footer.seconds}
              chevron={item.footer.chevron === true ? 'right' : undefined}
              t={t}
            />
          )}
        </div>
      );
    case 'fail':
      return <FailRow item={item} t={t} />;
    case 'fallback':
      // 兜底轨迹行（XMON-46）：一次「模型 X 失败 → 已切换 Y」。error 空串 =
      // 该次没带 error 原文，走无原因子句——不出一句「失败：，已切换」。
      return (
        <div className="chat-row chat-row--agent">
          <span className="chat-avatar">
            <img src="/avatar-robot-1.svg" alt="" />
          </span>
          <span className="chat-text">
            <p className="chat-para chat-para--fallback">
              {item.error === ''
                ? t('模型 {model} 失败，已切换 {next}', { model: item.model, next: item.next })
                : t('模型 {model} 失败：{error}，已切换 {next}', {
                    model: item.model,
                    error: item.error,
                    next: item.next,
                  })}
            </p>
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
            {/* #471: the braille spinner the r7 16/26/26d captures froze
                mid-animation now turns — a 10-frame reel scrolling one slot
                per 90ms step, frozen back on ⠙ under reduced motion.
                aria-hidden: the label text is the accessible live cue, the
                animation is never the only channel. */}
            <span className="chat-spinner" aria-hidden="true">
              <span className="chat-spinner-reel">
                {SPINNER_FRAMES.map((frame) => (
                  <span key={frame}>{frame}</span>
                ))}
              </span>
            </span>
            {item.seconds != null && (
              // tabular figures: the 3s→10s tick must not shift the row tail
              <span className="chat-streaming-secs">{item.seconds}s</span>
            )}
            <ChevronRight width={10} height={10} />
            <span className="chat-streaming-label">{t(item.label)}</span>
          </span>
        </div>
      );
    case 'plan':
      return (
        <>
          <div className="chat-plan">
            <FileTab width={14} height={14} />
            <span className="chat-plan-title">{item.title}</span>
            {onOpenPlan != null ? (
              <button
                type="button"
                className="chat-plan-open"
                aria-label={t('打开方案')}
                onClick={onOpenPlan}
              >
                <ExternalLink width={12} height={12} />
              </button>
            ) : (
              <span className="chat-plan-open">
                <ExternalLink width={12} height={12} />
              </span>
            )}
          </div>
          <div className="chat-preview">{item.preview}</div>
          <ActionRow
            seconds={item.seconds}
            bare={item.seconds == null}
            chevron={item.chevron === true ? 'right' : undefined}
            t={t}
          />
        </>
      );
    case 'tools':
      return <ToolsRow item={item} t={t} />;
    case 'elapsed':
      return <ActionRow seconds={item.seconds} t={t} />;
    case 'review':
      return (
        <div className="chat-row chat-row--agent">
          <span className="chat-avatar">
            <img src="/avatar-robot-1.svg" alt="" />
          </span>
          <span className="chat-text">
            {/* 结论先行（r8 §3.1 60）：单段总结 — paragraph chip "审核结论"
                + 文本。 */}
            <p className="chat-para chat-para--review-head">
              <span className="chat-review-tag">{t('审核结论')}</span>
              <Segments segments={inlineSegments(item.conclusion)} codeClassName="chat-code" />
            </p>
            {/* 编号 findings（r8 §3.1 60/61）：每条 = 严重度后缀 + 标题 +
                描述 + 引用位（文件:行）+ 可选建议。沿用 chat-para--num
                序号样式（与既有 finding fixture 同族）。 */}
            {item.findings.map((f) => (
              <div key={f.id} className={`chat-review-finding chat-review-finding--${f.severity}`}>
                <p
                  className="chat-para chat-para--num"
                  data-ordinal={Number.parseInt(f.id, 10) || 0}
                >
                  <span className="chat-num-mark">{f.id}.</span>
                  <span className="chat-review-severity">
                    {t(`(${f.severity})` as '(blocking)' | '(suggestion)' | '(info)')}
                  </span>
                  <Segments segments={inlineSegments(f.summary)} codeClassName="chat-code" />
                </p>
                {f.description !== undefined && f.description !== '' && (
                  <p className="chat-para">
                    <Segments segments={inlineSegments(f.description)} codeClassName="chat-code" />
                  </p>
                )}
                {(f.file !== undefined || f.line !== undefined) && (
                  <p className="chat-para chat-para--quote chat-review-quote">
                    <Segments
                      segments={inlineSegments(
                        `${f.file ?? ''}${f.line !== undefined ? `:${f.line}` : ''}`,
                      )}
                      codeClassName="chat-code"
                    />
                  </p>
                )}
                {f.suggestion !== undefined && f.suggestion !== '' && (
                  <p className="chat-para chat-para--quote chat-review-suggestion">
                    <Segments
                      segments={inlineSegments(t('建议：{body}', { body: f.suggestion }))}
                      codeClassName="chat-code"
                    />
                  </p>
                )}
              </div>
            ))}
          </span>
          <ActionRow t={t} />
        </div>
      );
  }
}

/** 失败行（r8 54/73 canon）+ 兜底尝试明细（XMON-46）：全部兜底也耗尽时，
 *  该步每次模型尝试随行落账，「查看尝试记录」展开明细——标题/指引/链接三行
 *  是既有文案 canon，展开面是纯增项。无 attempts（旧数据/未触发兜底）时
 *  渲染与从前逐字相同，连切换钮都不出。 */
function FailRow({ item, t }: { item: Extract<TranscriptItem, { kind: 'fail' }>; t: TFunc }) {
  const [expanded, setExpanded] = useState(false);
  const attempts = item.attempts ?? [];
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
        {attempts.length > 0 && expanded && (
          <div className="chat-fail-attempts">
            {attempts.map((attempt, i) => (
              // 明细按契约 attempts[] 原序（主模型首试在前）；同模型可能重复
              // 出现（换回同一模型的兜底），故 key 带下标。
              <div key={`${i}-${attempt.model}`} className="chat-fail-attempt">
                <span className="chat-fail-attempt-model">{attempt.model}</span>
                {/* 缺 error 的占位文案（不是真的错误原文）用弱色：与上面
                    两行的真实 error 原文长得一样，等于把「没给原因」说成
                    「原因就是这个」。 */}
                {attempt.error == null ? (
                  <span className="chat-fail-attempt-error chat-fail-attempt-error--none">
                    {t('未提供错误信息')}
                  </span>
                ) : (
                  <span className="chat-fail-attempt-error">{attempt.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
        {attempts.length > 0 && (
          <button
            type="button"
            className="chat-fail-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? t('收起') : t('查看尝试记录')}
            <ChevronDown
              width={10}
              height={10}
              {...(expanded ? {} : { className: 'chat-fail-toggle-icon' })}
            />
          </button>
        )}
      </span>
      <ActionRow t={t} />
    </div>
  );
}

/** Tool-call group (r7 27 collapsed `完成 Ns ▸` / 28 pills + 收起): the
 *  expansion is pure client state (#306 接真) — the fixture/live mapper
 *  freezes the arrival state, the collapsed footer row expands, the 收起
 *  link collapses. Row state rides the row instance (index-keyed like the
 *  rest of the transcript; live appends land after the group). */
function ToolsRow({ item, t }: { item: Extract<TranscriptItem, { kind: 'tools' }>; t: TFunc }) {
  const [expanded, setExpanded] = useState(item.expanded);
  return (
    <>
      <ActionRow
        seconds={item.seconds}
        chevron={expanded ? 'down' : 'right'}
        t={t}
        toggle={{ expanded, onToggle: () => setExpanded((v) => !v) }}
      />
      {expanded && (
        <>
          <div className="chat-tools">
            {item.pills.map((pill, i) => {
              // #469: the call's stdout/stderr rides index-aligned in
              // `outputs`; render it as its own left-aligned mono block
              // under the pill instead of flattening into `.chat-note`.
              const output = item.outputs?.[i];
              return (
                <div key={`${i}-${pill}`} className="chat-tool">
                  <div className="chat-tool-pill">
                    <Terminal width={12} height={12} />
                    <span className="chat-tool-label">{pill}</span>
                  </div>
                  {output != null && output !== '' && (
                    <pre className="chat-tool-output">{output}</pre>
                  )}
                </div>
              );
            })}
          </div>
          <button type="button" className="chat-collapse" onClick={() => setExpanded(false)}>
            {t('收起')}
            <ChevronDown width={10} height={10} className="chat-collapse-icon" />
          </button>
        </>
      )}
    </>
  );
}

export function Transcript({ transcript, onOpenPlan }: TranscriptProps) {
  const { t } = useI18n();
  return (
    <>
      {transcript.map((item, i) => (
        // fixture order is stable; items carry no ids
        <Row key={i} item={item} t={t} onOpenPlan={onOpenPlan} />
      ))}
    </>
  );
}
