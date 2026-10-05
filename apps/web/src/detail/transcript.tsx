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
import { type CurrentUser, useLiveData } from '../api/provider.js';
import { LiveRow } from '../components/chat/live-row.js';
import { Button } from '../components/ui/button.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
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

/** Live step facts the streaming row discloses (#873): the panel is the one
 *  thing the row can say that the timeline does not already carry. Null =
 *  no panel, and with it no chevron. */
export interface LiveStep {
  /** Phase label of the running step (规划 / 构建 / 审核). */
  step: string;
  /** Executing machine name, when one is already known. */
  machine: string | null;
}

interface TranscriptProps {
  transcript: TranscriptItem[];
  /** #873: the running step behind the live row (null = unknown/fixture). */
  liveStep?: LiveStep | null;
  /** XMON-105: the run's executing agent — agent message rows (robot /
   *  fail / streaming / review) render this agent's avatar (avatarUrl
   *  override > dicebear displayName seed > static robot asset), the same
   *  identity the board card / team page / ⌘K rows show for it. Null =
   *  unassigned run, rows keep the static asset. */
  agent?: { displayName: string; avatarUrl: string | null } | null;
  /** #366: the collapsed plan card's open glyph activates the plan
   *  document in the right pane (doc view, plan surface). Absent = the
   *  glyph stays the inert capture form. */
  onOpenPlan?: () => void;
}

/** Elapsed label: `Ns` under a minute (r7 21s/19s), `Nm Ns` above
 *  (r8 56 plan card `完成 2m 41s`, #74 dict template). */
function formatElapsed(seconds: number, t: TFunc): string {
  const elapsed = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return t('完成 {elapsed}', { elapsed });
}

/** Message action row (r7 17/28, r8 63/65/73, #634 follow-up re-measured
 *  2026-10-02): optional copy button, optional restore icon, then the
 *  optional `| 完成 Ns` elapsed tail. Every footer variant observed is a
 *  subset of this one row. With `toggle` the elapsed tail + chevron render
 *  as the tool group's expand/collapse button (#306) instead of static
 *  nodes.
 *
 *  #634 follow-up: the reference footer's copy is a REAL button (measured:
 *  robot row copies the message markdown, the user row copies the todo
 *  markdown link), and its chevron only ever exists as a group expander —
 *  the done-phase footers carry none. Our copy icon used to be inert
 *  decoration on every row and the robot/plan footers carried an inert
 *  `›`: shape without semantics. Now `copy` carries the row's human
 *  readable text (absent = no copy affordance at all) and the chevron
 *  renders only where `toggle` gives it something to expand. */
function ActionRow({
  restore,
  seconds,
  bare,
  copy,
  t,
  toggle,
}: {
  restore?: boolean;
  seconds?: number;
  /** `完成` with no seconds (reused-plan card, r8 76). */
  bare?: boolean;
  /** Clipboard payload = the row's human-readable content. Absent = the
   *  row renders no copy affordance (an icon that copies nothing is the
   *  bug this follow-up removes). */
  copy?: string;
  t: TFunc;
  /** #306: the tools group's footer doubles as the expander (collapsed
   *  r7 27 ↔ expanded 28 family, same law as 全部展开/全部收起). */
  toggle?: { expanded: boolean; onToggle: () => void };
}) {
  const tail = (
    <>
      {(seconds != null || bare === true) && (
        <span className="chat-foot-elapsed">
          {seconds != null ? formatElapsed(seconds, t) : t('完成')}
        </span>
      )}
      {toggle != null &&
        (toggle.expanded ? (
          <ChevronDown width={10} height={10} className="chat-foot-chevron" />
        ) : (
          <ChevronRight width={10} height={10} className="chat-foot-chevron" />
        ))}
    </>
  );
  return (
    <div className="chat-row-icons">
      {copy != null && (
        // p-0 keeps the 13px icon box the inert span carried, so the row
        // geometry the #470 fence pins does not move.
        <Button
          variant="ghost"
          className="chat-copy h-auto rounded-none justify-start p-0 active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
          aria-label={t('复制')}
          onClick={() => {
            void navigator.clipboard.writeText(copy);
          }}
        >
          <Copy width={13} height={13} />
        </Button>
      )}
      {restore === true && <Restore width={13} height={13} />}
      {toggle == null ? (
        tail
      ) : (
        // XMON-24：行图标 toggle 切 shadcn ghost——皮肤/几何全在
        // .chat-row-icons(--toggle) per-face（font:inherit 顺手灭底座字号，
        // bg transparent 灭 hover/aria-expanded 底）；utilities 只清 h-8、
        // justify、active 位移、svg 强制 16px（chevron 属性 10px）四条差额。
        // #634 follow-up：toggle 退为行内尾段钮（copy 钮独立成兄弟），
        // 嵌套钮内的左 padding 由后代选择器归零（unlayered 压 utilities）。
        <Button
          variant="ghost"
          className="chat-row-icons--toggle h-auto rounded-none justify-start active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
          aria-expanded={toggle.expanded}
          onClick={toggle.onToggle}
        >
          {tail}
        </Button>
      )}
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

/** XMON-105: agent message-row avatar — the executing agent's own identity
 *  (avatarUrl override > dicebear displayName seed), static Notionists
 *  asset only for unassigned runs. Same resolution as every other agent
 *  avatar surface (board card / team page / ⌘K rows), so one agent reads
 *  as one face across the app. */
function AgentRowAvatar({
  agent,
}: {
  agent: { displayName: string; avatarUrl: string | null } | null;
}) {
  return (
    <span className="chat-avatar">
      <SeededAvatar
        name={agent?.displayName}
        src={agent?.avatarUrl}
        fallback="/avatar-robot-1.svg"
      />
    </span>
  );
}

function Row({
  item,
  t,
  onOpenPlan,
  agent,
  user,
  liveStep,
}: {
  item: TranscriptItem;
  t: TFunc;
  onOpenPlan?: () => void;
  agent: { displayName: string; avatarUrl: string | null } | null;
  user: CurrentUser;
  liveStep: LiveStep | null;
}) {
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
      // #634: note text is data (daemon/system prose or mapper labels like
      // 记忆已更新) — route it through t() so en-dict entries apply; unknown
      // keys fall back to the zh original (translate.ts law).
      return <div className="chat-note">{t(item.text)}</div>;
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
              <SeededAvatar
                name={user.displayName}
                src={user.avatarUrl}
                fallback="/avatar-user.png"
              />
            </span>
            {/* #612：真实用户话语带 markdown 槽（live mapper 设置；robot 行
                #469 同款渲染期解析）——围栏/列表/标题不再按字面裸排。纯文本
                槽 = fixture 捕获形，DOM 与几何保持不变。 */}
            <span className={item.markdown != null ? 'chat-bubble chat-bubble--md' : 'chat-bubble'}>
              {item.markdown != null ? <ChatMarkdown text={item.markdown} /> : item.text}
            </span>
          </div>
          {item.seq != null && item.title != null && (
            <div className="chat-taskline">
              <span className="chat-taskline-seq">#{item.seq}</span>
              <span className="chat-taskline-title">{item.title}</span>
            </div>
          )}
          {/* #634 follow-up: the user row's copy is real too — the bubble's
              own text (the reference copies its todo markdown link here;
              our share surface for that is the 更多 menu's 复制链接). */}
          <ActionRow restore copy={item.markdown ?? item.text} t={t} />
        </>
      );
    case 'robot':
      return (
        <div className="chat-row chat-row--agent">
          <AgentRowAvatar agent={agent} />
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
              copy={robotCopyText(item)}
              t={t}
            />
          )}
        </div>
      );
    case 'fail':
      return (
        <div className="chat-row chat-row--agent">
          <AgentRowAvatar agent={agent} />
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
          <ActionRow copy={[item.title, item.body, ...item.links].join('\n')} t={t} />
        </div>
      );
    case 'streaming':
      return (
        <div className="chat-row chat-row--agent">
          <AgentRowAvatar agent={agent} />
          {/* #873: the row itself is the shared live row (components/chat/
              live-row) — same skeleton, same disclosure rule and same honest
              clock as the chief drawer's in-flight row. What differs per
              surface is the skin and what the panel discloses: here it is
              the running step (which step, on which machine), which is the
              only thing this surface knows that the timeline does not
              already show. No panel data = no panel, and then no chevron
              either (#634: a shape must carry semantics). */}
          <LiveRow
            variant="detail"
            label={item.label}
            startedAt={item.startedAt}
            seconds={item.seconds}
            disclosure={
              liveStep != null ? { expand: '展开实时步骤', collapse: '收起实时步骤' } : null
            }
          >
            {liveStep != null && (
              <div className="chat-live-panel">
                <span className="chat-live-line">{t('本步：{n}', { n: liveStep.step })}</span>
                {liveStep.machine != null && (
                  <span className="chat-live-line">
                    {t('执行机器：{n}', { n: liveStep.machine })}
                  </span>
                )}
              </div>
            )}
          </LiveRow>
        </div>
      );
    case 'plan':
      return (
        <>
          <div className="chat-plan">
            <FileTab width={14} height={14} />
            <span className="chat-plan-title">{item.title}</span>
            {onOpenPlan != null ? (
              // XMON-24：打开方案钮切 shadcn ghost；皮肤全在 .chat-plan-open
              // per-face。字号/行高还原裸钮 preflight 的 font:inherit，
              // svg 免底座强制 16（属性 12px）。span 态不在此列。
              <Button
                variant="ghost"
                className="chat-plan-open h-auto rounded-none justify-start text-[length:inherit] leading-[inherit] font-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
                aria-label={t('打开方案')}
                onClick={onOpenPlan}
              >
                <ExternalLink width={12} height={12} />
              </Button>
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
            copy={`${item.title}\n${item.preview}`}
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
          <AgentRowAvatar agent={agent} />
          <span className="chat-text">
            {/* 结论先行（r8 §3.1 60）：单段总结 — paragraph chip "审核结论"
                + 文本。#700：extractionError 在位 = daemon verdict 提取失败
                —— chip 换「判定提取失败」（danger 色，与 blocking finding
                同色系），正文 = daemon 原因；与「审核未返回结论」兜底（旧
                daemon 无信号）在审核面上一眼可分辨——提取器失败不是审核
                没结论。 */}
            <p className="chat-para chat-para--review-head">
              <span
                className={`chat-review-tag${
                  item.extractionError !== undefined ? ' chat-review-tag--error' : ''
                }`}
              >
                {t(item.extractionError !== undefined ? '判定提取失败' : '审核结论')}
              </span>
              <Segments
                segments={inlineSegments(item.extractionError ?? item.conclusion)}
                codeClassName="chat-code"
              />
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
          <ActionRow copy={reviewCopyText(item)} t={t} />
        </div>
      );
  }
}

/** #634 follow-up copy payloads — the row's human-readable content, the
 *  reference footer copy's measured law (robot row copies the message
 *  markdown verbatim). */
function robotCopyText(item: Extract<TranscriptItem, { kind: 'robot' }>): string {
  if (item.markdown != null) return item.markdown;
  return (item.paragraphs ?? [])
    .map((raw) => (Array.isArray(raw) ? raw : raw.segments).map((seg) => seg.text).join(''))
    .join('\n\n');
}

function reviewCopyText(item: Extract<TranscriptItem, { kind: 'review' }>): string {
  return [
    item.extractionError ?? item.conclusion,
    ...item.findings.map((f) => `${f.id}. (${f.severity}) ${f.summary}`),
  ].join('\n');
}

function toolsCopyText(item: Extract<TranscriptItem, { kind: 'tools' }>): string {
  return item.pills
    .map((pill, i) => {
      const output = item.outputs?.[i];
      return output != null && output !== '' ? `${pill}\n${output}` : pill;
    })
    .join('\n');
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
        copy={toolsCopyText(item)}
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
          {/* XMON-24：收起钮切 shadcn ghost——皮肤全在 .chat-collapse
              per-face（bg transparent 灭 hover 底）；utilities 只清 h-8、
              justify、active 位移与 svg 16px 强制（属性 10px）。 */}
          <Button
            variant="ghost"
            className="chat-collapse h-auto rounded-none justify-start font-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
            onClick={() => setExpanded(false)}
          >
            {t('收起')}
            <ChevronDown width={10} height={10} className="chat-collapse-icon" />
          </Button>
        </>
      )}
    </>
  );
}

export function Transcript({
  transcript,
  agent = null,
  onOpenPlan,
  liveStep = null,
}: TranscriptProps) {
  const { t } = useI18n();
  // XMON-105: the user row's avatar is the logged-in user's own identity
  // (sidebar chip / account head share it), not a per-surface static asset.
  const { user } = useLiveData();
  return (
    <>
      {transcript.map((item, i) => (
        // fixture order is stable; items carry no ids
        <Row
          key={i}
          item={item}
          t={t}
          onOpenPlan={onOpenPlan}
          agent={agent}
          user={user}
          liveStep={liveStep}
        />
      ))}
    </>
  );
}
