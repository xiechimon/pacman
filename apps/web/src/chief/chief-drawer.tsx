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
// dialog，PATCH chief model 槽落库回显）；行首 = 运行时标记（pi 出 RuntimePi
// 块状 π、claude-code 出 RuntimeClaudeCode 品牌星标——正本 = 参考站
// providers 运行时 tab SVG，用户返工裁决：要运行时 SVG 不要 Agent 头像；
// FAB / 消息流的 Agent 头像脸在各自面继续生效）；消息行复制
// glyph 翻真 clipboard 钮（local-first 面存在），恢复/foot 折叠 chevron 无
// 后端面按 #306/#146 二分律移除不渲染；gear 各族可达（非 board 面落 board
// 设置视图深链，ChiefWakePanel 兜底后结构上恒在）。
//
// #732（2026-10-03 用户裁决全开，翻案 #146 隐藏裁决）：composer 行开闸渲染
// 附件 + 提及工具（detail composer 同款交互面——内联 @ 补全 #728、剪贴板图片
// 粘贴 #729、工具条 attach + mention 钮）。#146 的 local-first 无后端面前提
// 已被落地的 grant/upload/read 链与提及 wire  retire——只开交互面，不加新后端
// 面。语音输入维持 wontfix 不渲染（#304 C5，本票不含）。
// #306 wontfix 出账：r8 随拍在线程视图头部多出的「更多」（⋮）钮——原站
// 菜单内容从未点开无正典（r8-chief-panel-adhoc §3），pacman server chief
// 面亦无线程管理 mutation（GET/POST threads 外无删除/重命名端点），无
// local-first 对象面，按 M7 处置二分律移除不渲染；头部三钮双视图同律。
// #645：头部 +（新主题）挂裸键 N（抽屉作用域——overlays/hotkeys 的
// useChiefNewThreadHotkey，enabled 门 = 开态；输入态守卫 = _plain_ 可编辑
// 律，composer 聚焦时 n 归打字员）；钮载 KbdHint 的 N 悬浮提示（below 落位）
// + aria-keyshortcuts；键与钮同 handler（触发 + 收切换器 popover）。

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  CHIEF_INPUT_PLACEHOLDER,
  CHIEF_INPUT_PLACEHOLDER_STEERING,
  type ChiefCompactionModel,
} from '@pacman/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { attachFile } from '../api/attachments.js';
import { useMachines, useMembers, useProjects, useSkills, useTodos } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { ThinkingRow, ToolActivityRow } from '../components/chat/agent-rows.js';
import { LiveRow, LiveSignal } from '../components/chat/live-row.js';
import { useChatFollow } from '../components/chat/use-chat-follow.js';
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { KbdHint } from '../components/ui/kbd-hint.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { Textarea } from '../components/ui/textarea.js';
import { ChatMarkdown } from '../detail/chat-markdown.js';
import type { ChiefContent, ChiefSegment, ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import {
  ArrowUp,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  ChiefFaceDashed,
  ChiefFolder,
  ChiefGear,
  ChiefHash,
  ChiefUserPlus,
  Copy,
  FileText,
  Grid2x2,
  Paperclip,
  Plus,
  Restore,
  RuntimeClaudeCode,
  RuntimePi,
  X,
} from '../icons/index.js';
import { attachmentFailureTitle } from '../overlay/attachment-paste.js';
import { AttachmentStrip } from '../overlay/attachment-strip.js';
import { useComposerWire } from '../overlay/composer-wire.js';
import { type MentionGroups, MentionInline, MentionPicker } from '../overlay/mention-picker.js';
import { SlashHelp, SlashMenu } from '../overlay/slash-menu.js';
import { useChiefNewThreadHotkey } from '../overlays/hotkeys.js';
import { ChiefIdentity } from './chief-identity.js';
import { ChiefModelPopover } from './chief-model-popover.js';
import { AVATAR_IMG_CLS, AVATAR_SLOT_CLS } from './recipes.js';

/** 抽屉的 dock 行（ADR 0004 D2：面板是行内最后一个 flex 项、内容兄弟让位 418）。
 *  挂载点清单（#656 票面）：board-page(.board-shell) / chief-wake 各族壳
 *  (pages .page-main / resources .res-main / secondary .secondary-main /
 *  detail .detail-body)。Portal 的 container 必须是这一行本身——传错容器（如
 *  夹在中间的无名 wrapper）会让 aside 落错父、D2 让位崩（(b′) 实测 240px）。
 *  故由锚点向上走到最近的 dock 行类，保证 container 恒为真 row。五个类名是
 *  跨域零规则结构钩子（spec/22 §5.0 残留律，#944 的 res-main 先例）：CSS
 *  规则不住本域，classList 机制消费；Portal 包装层的 display:contents 自
 *  #950 起改挂 Portal 自身 className（Base UI Portal 透传 div props），
 *  不再借宿各 dock 行的子选择器。 */
const DOCK_ROWS = ['board-shell', 'page-main', 'res-main', 'secondary-main', 'detail-body'];

/** 抽屉壳（#950 清零，旧 .chief-drawer 等值）：dock 行内 418 让位列
 *  （min() 复合形态 §3.1(b)），surface 底 + 左缘 1px 发丝缝（Hairlines Not
 *  Shadows），#688 阶梯的 docked chrome 档（z-docked：压过 in-flow 内容、
 *  让位一切活动面）；列自成 stacking context，抽屉内部弹层层序 scoped。
 *  类名 chief-drawer 保留为零规则机制钩子：overlays/hotkeys.ts 的 ⌘J
 *  守卫走 closest('.chief-drawer')，e2e 以它做抽屉 scope 锚。 */
const DRAWER_CLS =
  'chief-drawer flex w-[min(418px,100%)] flex-none flex-col border-l border-l-(--border) bg-(--card) z-(--z-docked)';

/** 退场腿（D4 内容瞬时贴合）：关态离流，absolute 落在刚腾出的槽位上播
 *  slide-out（旧 .chief-drawer[data-closed] 等值；Base UI keepMounted 缺席，
 *  退场保活靠 transition-status，见 JSX 注释）。 */
const DRAWER_CLOSED_CLS =
  'data-closed:absolute data-closed:top-0 data-closed:right-0 data-closed:bottom-0';

/** 头部 icon 钮（旧 .chief-head-actions button 元素选择器等值：20×20 /
 *  零装饰 / tertiary 墨 / 无 hover 反馈——旧 unlayered 规则恒压 ghost 件
 *  配方，迁移后按七通道律显式钉回）。 */
const HEAD_ICON_BTN_CLS =
  "size-5 cursor-pointer justify-center rounded-none border-none bg-transparent p-0 text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) dark:hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto";

/** 消息行 20×20 工具钮（旧 .chief-msg-tool 几何等值；hover 升
 *  surface-secondary 底 + secondary 墨；aria-expanded 涂底保留件行为、墨
 *  钉回基墨）。墨槽 dim→tertiary：#950 better-colors 实测 dim 在本面底上
 *  light 2.89:1 低于正典对 --text-dim 槽自钉的 3:1 下限（spec/22 §1.8），
 *  按 #908 裁决 2 换消费面槽引用（token 值不动）。 */
const MSG_TOOL_BTN_CLS =
  "size-5 cursor-pointer rounded-none border-none bg-transparent text-(--text-tertiary) hover:bg-(--secondary) hover:text-(--text-secondary) dark:hover:bg-(--secondary) aria-expanded:bg-muted aria-expanded:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto";

/** composer 工具钮（旧 .chief-tool 几何等值：20×20 / hover 只升墨——底色
 *  hover 是 ghost 件既有行为，旧面未覆写，保留；圆角随件档）。墨槽
 *  dim→tertiary 同 MSG_TOOL_BTN_CLS 注（light 2.73:1 < 3）。 */
const TOOL_BTN_CLS =
  "size-5 cursor-pointer text-(--text-tertiary) hover:text-(--text-secondary) dark:hover:text-(--text-secondary) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto";

/** 发送钮双态（旧 .chief-send / .is-on 等值：歇态 seg-active 底、hover 升
 *  secondary 墨不换底；有草稿 = card-button 实底 + on-accent 墨，hover 不动。
 *  is-on 状态类退役，双态随 draft 条件类切换）。歇态墨 dim→tertiary：dim 压
 *  seg-active 双主题皆低于 3:1（light 2.53 / dark 2.4），#950 实测换槽。 */
const SEND_BTN_CLS =
  'ml-auto cursor-pointer rounded-md border-0 bg-(--seg-active) text-(--text-tertiary) hover:bg-(--seg-active) hover:text-(--text-secondary) dark:hover:bg-(--seg-active) aria-expanded:bg-(--seg-active) active:not-aria-[haspopup]:translate-y-0';
const SEND_ON_CLS =
  'bg-(--card-button) text-(--text-on-accent) hover:bg-(--card-button) hover:text-(--text-on-accent)';

/** 回合过程折叠面（旧 .chief-turn-tools 等值：foot 下挂工具行表，
 *  surface-secondary 底 6/8 内垫，mono 名 + 秒数 + 失败徽标 dim 墨压底）。 */
const TURN_TOOLS_CLS = 'mt-1.5 flex flex-col gap-[3px] rounded-none bg-(--secondary) px-2 py-1.5';
const TURN_TOOL_ROW_CLS = 'flex items-center gap-2 font-mono text-[11px] text-(--text-tertiary)';
const TURN_TOOL_NAME_CLS = 'min-w-0 flex-auto truncate';

/** 消息列（旧 .chief-msg-col 等值 + #650 抽屉节奏 scoped 覆盖）：正文
 *  14px/24px、primary 墨由容器 inheritance 承接（chat-markdown 块自身
 *  不带字号规则，detail.css 正本只管块距）；段距 2px 与气泡首尾块 margin
 *  归零两条覆盖的对象是 detail.css 的 unlayered 块距正典（.chat-para +
 *  .chat-para 7px、.chat-md-code 8px 上下）——CSS 级联律：unlayered 恒压
 *  layered utility，important 修饰是 utility 层赢过 unlayered 正典的唯一
 *  出口（important 声明的层序优先于一切 normal 声明）。 */
const MSG_COL_CLS =
  'min-w-0 flex-1 text-sm leading-6 text-(--foreground) [&_.chat-para+.chat-para]:mt-0.5!';
const BUBBLE_CLS =
  'rounded-(--radius-popover) bg-(--secondary) px-3 py-2.5 text-sm leading-6 text-(--foreground)';
const BUBBLE_MD_CLS = '[&>:first-child]:mt-0! [&>:last-child]:mb-0!';

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

/** robot 消息全文（#615 foot 复制钮载荷）：markdown 行取原文（#469
 *  transcript 同律——复制的是消息 markdown 源）；段数组行（fixture 捕获形）
 *  段落换行拼接 + bullet 行随附。 */
function robotText(item: {
  paragraphs?: ChiefSegment[][];
  bullets?: ChiefSegment[][];
  markdown?: string;
}): string {
  if (item.markdown != null) return item.markdown;
  const lines = (item.paragraphs ?? []).map(segmentsText);
  for (const b of item.bullets ?? []) lines.push(`- ${segmentsText(b)}`);
  return lines.join('\n');
}

/** 行内 mention chip 皮肤（#950 清零，旧 .chief-chip-todo/.chief-chip-agent
 *  等值：1px/6px 内垫、4px 圆角（一次性尺寸 §3.1(a)）、2px 边距、1px 光学
 *  上抬；todo = chip-plan 令牌对，agent = seg-active 底 + 次级墨）。 */
const CHIP_INLINE_CLS =
  'mx-0.5 inline-flex items-center gap-1 rounded-[4px] px-1.5 py-px align-[1px] text-xs';

/** Inline runs: plain text, mono chip, `#N` todo chip, agent chip. */
function Segments({ segments }: { segments: ChiefSegment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        if (s.todo != null)
          return (
            // chip 的 data-testid = #910 二级载体：spec 钉的是「实体成 chip」
            // 本身（F-R1/R3 字面漏出的对立面），纯文本载体区分不了 chip 与
            // 漏出的字面量。
            <span
              key={i}
              data-testid="chief-chip-todo"
              className={`${CHIP_INLINE_CLS} bg-(--chip-plan-bg) text-(--chip-plan-fg)`}
            >
              <FileText width={11} height={11} />
              {s.todo}
            </span>
          );
        if (s.agent != null)
          return (
            <span
              key={i}
              data-testid="chief-chip-agent"
              className={`${CHIP_INLINE_CLS} bg-(--seg-active) text-(--text-secondary)`}
            >
              <ChiefFaceDashed width={11} height={11} />
              {s.agent}
            </span>
          );
        if (s.code)
          return (
            <code key={i} className="rounded-[4px] bg-(--muted) px-[5px] py-px font-mono text-xs">
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
   * 缺省 = fixture 静态面（readOnly draft，发送钮惰性）。返回 Promise =
   * 异步发送（#631：rejected 时 draft 保留不丢字，detail composer 同契）；
   * 同步 void = 发后即清（原语义）。 */
  onSend?: (text: string) => void | Promise<void>;
  /** 主题切换（live 面 threads popover 行点击）。 */
  onThread?: (title: string, index: number) => void;
  /** 新主题（头部 +，#146）：落回新线程视图，下一次发送开新 chief 线程
   * （threadId null = 新主题，wire 注记见 shared chief send schema）；
   * 缺省 = fixture 静态面，钮惰性。 */
  onNewThread?: () => void;
  /** #615 主模型覆盖槽当前值（live = chief 封套真值；null = 继承绑定
   *  Agent）；fixture 面缺省 = null。 */
  modelValue?: ChiefCompactionModel | null;
  /** #615 主模型候选（live = toModelOptions 投影，非 pi runtime 段）；缺省 = 仅默认行。 */
  modelOptions?: ModelOption[];
  /** #615 live 面：模型 dialog 选定 = PATCH chief model 槽；缺省 = fixture
   *  律（选择即关，零请求）。 */
  onPickModel?: (value: ChiefCompactionModel | null) => void;
  /** #615 返工 live 面：恢复钮确认后 = POST chief threads rewind（截断锚后
   *  消息 + 新会话重发）；缺省 = fixture 律（确认层 accept 关窗零请求）。 */
  onRewind?: (messageId: string) => void;
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
  onRewind,
}: DrawerProps) {
  const { t } = useI18n();
  // #650 / XMON-105: 用户行头像身份单源（live = /api/user/me；fixture =
  // canon 常量，avatarUrl 覆盖 > dicebear 名字种子 > 静态兜底）。
  const { live, teamId, user } = useLiveData();
  // #732：live 面的提及数据源（todo-detail-page / new-task-surface 同五源
  // 投影 canon；enabled=live，fixture 面查询静默 → 空组 → wire EMPTY_GROUPS
  // → inline 永不开、popover 零计数开面）。
  const todosQ = useTodos(teamId, live);
  const membersQ = useMembers(teamId, live);
  const projectsQ = useProjects(teamId, live);
  const skillsQ = useSkills(teamId, live);
  const machinesQ = useMachines(teamId, live);
  const mentionGroups: MentionGroups = {
    todo: (todosQ.data ?? []).map((td) => ({
      id: td.id,
      label: `#${td.seqNum} ${td.title}`,
      seq: td.seqNum,
      subtitle: td.phase,
    })),
    agent: (membersQ.data ?? [])
      .filter((m) => m.memberType === 'agent')
      .map((m) => ({
        id: m.actorId,
        label: (m.actor as { displayName?: string } | undefined)?.displayName ?? m.actorId,
        subtitle:
          (m.actor as { description?: string | null } | undefined)?.description ?? undefined,
      })),
    project: (projectsQ.data ?? []).map((p) => ({ id: p.id, label: p.name })),
    skill: (skillsQ.data ?? []).map((s) => ({
      id: s.id,
      label: s.name,
      subtitle: s.description ?? undefined,
    })),
    machine: (machinesQ.data ?? []).map((m) => ({ id: m.id, label: m.name })),
  };
  // #732：live 面的附件委托（todo-detail-page §#310 同款配方：逐文件 grant +
  // upload scope 'message'，失败 toast 点名 + 成功 token 仍落；token 注入由
  // wire hook 行原子做）。fixture 面无委托 → wire 附件链全惰。
  const onAttachment =
    onSend != null
      ? async (files: File[]) => {
          const tokens: string[] = [];
          for (const file of files) {
            try {
              const r = await attachFile({ file, scope: 'message' });
              tokens.push(r.token);
            } catch (err) {
              console.error('attachment failed', file.name, err);
              toast.error(t(attachmentFailureTitle(err)), {
                description: file.name,
              });
            }
          }
          return tokens;
        }
      : undefined;
  const [threadsOpen, setThreadsOpen] = useState(chief.threadsOpen ?? false);
  const [modelOpen, setModelOpen] = useState(false);
  // #651 流式视口：抽屉 body 是真滚动容器（overflow-y auto，#950 起
  // utility 承载）。打开/切线程落底（chat 面通行律：最新消息在底部；
  // retained-mount 节点常驻，open 翻 true 时 effect 即发）。
  const bodyRef = useRef<HTMLDivElement>(null);
  const streamLen = chief.stream?.length ?? 0;
  const lastItem = streamLen > 0 ? chief.stream?.[streamLen - 1] : undefined;
  const typingText =
    lastItem?.kind === 'robot' && lastItem.typing === true ? (lastItem.markdown ?? '') : null;
  // #873 跟随单源（components/chat/use-chat-follow，详情页对话列同款）：打开/
  // 切线程落底（chat 面通行律：最新消息在底部；retained-mount 节点常驻，
  // open 翻 true 时 effect 即发）；增量仅在视口已近底部时贴底——上翻读历史时
  // 不抢滚动条。打字行文本与行数是增长信号（250ms 聚合粒度）。本面是普通
  // 纵向滚动容器（reversed=false）。
  const { requestFollow } = useChatFollow({
    ref: bodyRef,
    // 增长信号 = 行数 + 打字行文本（250ms 聚合粒度）。拼成一个字符串而不是
    // 数组：[…] 字面量每次渲染都是新身份，效应会跟着每一次无关重渲跑。
    dep: `${streamLen}:${typingText ?? ''}`,
    reversed: false,
    active: open,
    resetDep: chief.threadTitle,
  });
  // #615 返工：恢复钮确认层锚（stream 行 index + live 消息 id）与过程折叠开态集。
  const [rewindConfirm, setRewindConfirm] = useState<{ index: number; id: string | null } | null>(
    null,
  );
  const [toolsOpen, setToolsOpen] = useState<Set<number>>(() => new Set());
  // #822→#873 在飞存在行的展开态由共享 LiveRow 自持：typing 行接管那一帧
  // streaming 分支整棵卸载，展开态随之清零（取代 race 不再需要抽屉级护栏）。
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
  // #625：输入逻辑层单源——draft / 发送（异步被拒保留 draft，#631 契约）/
  // 提及 / 附件 wire 住 overlay/composer-wire 的 useComposerWire，detail
  // composer 消费同一 hook；本文件只剩抽屉皮肤（节点、几何、占位双态）。
  // live 面 = 内部态草稿（editable）；fixture 面 = 静态只读回显（static
  // mode，无 setter）。#732（#146 隐藏裁决翻案）：live 面把数据源两件都传
  // 进去——mentionGroups（五源 live 投影；fixture 面查询静默 → 空组）与
  // onAttachment（逐文件 grant + upload 委托）；fixture 面两件皆缺省 →
  // inline 永不开、picker 零计数、粘贴/选件链全惰。
  const wire = useComposerWire({
    editable: onSend != null,
    draft: onSend != null ? undefined : (chief.draft ?? ''),
    // #873：读者自己发出去的那条必须看得见——跳最新端与详情面同一规则
    // （useChatFollow.requestFollow），四个分流出口之外的通用发送面。
    onSend:
      onSend == null
        ? undefined
        : (text: string) => {
            requestFollow();
            return onSend(text);
          },
    onAttachment,
    mentionGroups,
    // #841 `/` slash completion（detail composer #731 同 registry；正本对照
    // detail/composer.tsx `slash:` 块）。抽屉面无 AI 审核 / 停止句柄（工具条本
    // 就没这两钮），reviewAvailable / stopAvailable 双 false → 两条按 rule 47
    // 条件隐藏，菜单只剩 clear / attach / mention / help + 团队技能；`clear`
    // 语义与 detail 同 = 清空输入框（执行反馈走 wire 内 toast）。
    slash: {
      reviewAvailable: false,
      stopAvailable: false,
    },
    // #860: textarea follows the content up to 6 lines (20px), scrolling
    // internally beyond it (the XMON-102 fixed-height law is superseded).
    growCap: 120,
  });
  const {
    handlePaste,
    handleCaretMoved,
    handleCompositionEnd,
    handleBlur,
    fileInputRef,
    openFilePicker,
    attaching,
    pendingAttachments,
    onPickFiles,
    pickerOpen,
    togglePicker,
    closePicker,
    closeInline,
    inlineOpen,
    inlineCaret,
    inlineQuery,
    inlineRows,
    inlineHighlight,
    setInlineHighlight,
    inlineListboxId,
    inlineListboxRef,
    insertToken,
    insertTokens,
    insertFile,
    groups,
    // #841 `/` slash menu state（detail composer 同款解构；复用同一 hook
    // 面，故校验/语义零分叉）。
    slashOpen,
    slashQuery,
    slashCaret,
    slashSections,
    slashHighlight,
    setSlashHighlight,
    slashListboxId,
    slashListboxRef,
    closeSlash,
    acceptSlashRow,
    helpOpen,
    closeHelp,
    helpRows,
    helpSkillCount,
  } = wire;
  // #773：抽屉收起联动收弹层——模型 popover / 切换器 / 提及 picker /
  // 内联补全 / 恢复确认的 open 态都自持在抽屉内部，抽屉只收容器时它们跟
  // 着失活（FloatingShell 的 portal 锚随容器走）却不清零，重开即带回
  // stale 开态。X / Esc / ⌘J 同走 open=false，这里一处收敛。
  useEffect(() => {
    if (open) return;
    setModelOpen(false);
    setThreadsOpen(false);
    setRewindConfirm(null);
    closePicker();
    closeInline();
    closeSlash();
    closeHelp();
  }, [open, closePicker, closeInline, closeSlash, closeHelp]);
  // #146 Esc 分层改由 Base UI 壳代收（见下 onOpenChange）：Base UI 处理 Esc 时
  // 会拦下事件，窗口监听（旧 useEscapeClose）收不到。
  // (b″) dock 行发现：锚点 span 原位渲染，向上走到最近的 dock 行类作为 Portal
  // container——保证 portaled aside 是真 row 的最后一个直接子元素（D2）。
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [rowEl, setRowEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    let node = anchorRef.current?.parentElement ?? null;
    while (node !== null && !DOCK_ROWS.some((c) => node?.classList.contains(c))) {
      node = node.parentElement;
    }
    setRowEl(node);
  }, []);
  // #389: 开后焦点落草稿框（dialog 家族 autofocus 律）。OverlayMount 的
  // mounted 滞后 open 一帧（effect 里才 setMounted）——鲜开时 effect 跑在
  // 节点存在之前，故首焦由 ref callback 承载（SearchPanel attachInput
  // 先例）；retained-mount 窗口内重开节点未脱离、ref 不重火，由 [open]
  // effect 兜住。⌘J 热键呼出与 FAB 点击同路。
  const { textareaRef } = wire;
  const openRef = useRef(open);
  openRef.current = open;
  const attachComposer = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
      if (node && openRef.current) node.focus({ preventScroll: true });
    },
    [textareaRef],
  );
  useEffect(() => {
    if (open) textareaRef.current?.focus({ preventScroll: true });
  }, [open, textareaRef]);
  // #645: N = 新主题（抽屉作用域裸键）——与头部 + 钮同一 handler（触发 + 收
  // 切换器 popover）。enabled 门 = 开态且 live 面（fixture 面钮惰性，键同惰）；
  // 守卫与输入冲突律归 hotkeys 模块（composer 聚焦时 n 归打字员）。
  const newThread = useCallback(() => {
    if (onNewThread == null) return;
    onNewThread();
    setThreadsOpen(false);
  }, [onNewThread]);
  useChiefNewThreadHotkey(open && onNewThread != null, newThread);
  return (
    <DialogPrimitive.Root
      open={open}
      modal={false}
      // 外点不关（docked 布局列现状同）；Esc 分层由壳代收（#146）。
      disablePointerDismissal
      onOpenChange={(next: boolean, details?: { reason?: string }) => {
        if (next) return;
        if (details?.reason === 'escape-key' && threadsOpen) {
          setThreadsOpen(false);
          return;
        }
        onClose();
      }}
    >
      {/* 锚点原位占位（hidden 不占布局）；其祖先链向上找 dock 行作 Portal container */}
      <span ref={anchorRef} hidden aria-hidden="true" />
      {/* 不用 keepMounted：退场保活靠 Base UI 的 transition-status（exit 播完才
          卸载，同 OverlayMount 的保留语义、关后 DOM 归零）；keepMounted 会让关态
          残留隐藏节点，破 e2e 的 count-0 断言与热键的「关=不在 DOM」前提。 */}
      {rowEl !== null && (
        // Base UI Portal 恒在 container 里插一层 data-base-ui-portal 包装
        // div，aside 因此不可能是 row 的字面直接子元素；包装层经 Portal 的
        // className 透传设 display:contents（Tailwind `contents`），让 aside
        // 成为**等效**末位 flex 项：开 = 418 让位（D2），退场 absolute 离流
        // 内容瞬回，关 = aside display:none 包装层不贡献盒、内容回全宽。
        // （#950 前该律住 chief.css 的五 dock 行子选择器，现收归本 Portal
        // 自身——只影响本抽屉的包装层，不碰其它 portal。）
        <DialogPrimitive.Portal container={rowEl} className="contents">
          <DialogPrimitive.Popup
            // render 令 Popup 即 aside（贴右布局列本体）；slide 进出场落在 aside
            // 上，Base UI 经自身动画撑退场卸载窗。
            render={
              <aside
                className={`${DRAWER_CLS} ${DRAWER_CLOSED_CLS} duration-300 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right`}
                aria-label={t('总管')}
              />
            }
            initialFocus={false}
            finalFocus={false}
          >
            <header className="relative px-[17px] pt-[5px] pb-3">
              <div className="flex items-center">
                {/* XMON-23→#950：ghost 原语 + 头部 chip 皮肤 utility（旧
                .chief-chip 等值：零装饰 / tertiary 墨 / gap 6 / 可点）。
                中和件沿旧：h-auto（原语 h-8 会撑高 22.5 的行）、
                leading-[inherit]（原语 text-sm 的定值 20px 行高会压掉 15px
                标题继承的 22.5，像素对拍实测塌 1px）、shrink（chip 须收缩
                让 title 省略号生效）、hover/expanded 涂底钉回透明（旧
                unlayered 恒压件配方无反馈）、svg size-auto（ChiefHash 13px
                属性尺寸）。 */}
                <Button
                  variant="ghost"
                  className="h-auto min-w-0 shrink cursor-pointer gap-1.5 rounded-none border-none bg-transparent p-0 leading-[inherit] text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) dark:hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
                  aria-label={t('主题')}
                  onClick={() => setThreadsOpen((v) => !v)}
                >
                  <ChiefHash />
                  <span className="max-w-[210px] truncate text-[15px] font-semibold text-(--foreground)">
                    {t(chief.threadTitle)}
                  </span>
                  <ChevronDown width={12} height={12} />
                </Button>
                <div className="ml-auto flex items-center gap-3.5">
                  {/* 头部三钮：ghost/icon 收编 + HEAD_ICON_BTN_CLS（旧
                  .chief-head-actions button 元素选择器等值，七通道归零）。 */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`relative ${HEAD_ICON_BTN_CLS}`}
                    aria-label={t('新主题')}
                    aria-keyshortcuts="N"
                    onClick={onNewThread != null ? newThread : undefined}
                  >
                    <Plus width={18} height={18} />
                    {/* #645: N 悬浮提示（KbdHint 族第四消费点；below = 头部贴视口
                    顶，above 会落屏外）。relative 由钮自身承载——chip 绝对定位
                    的包含块。 */}
                    <KbdHint label="N" placement="below" />
                  </Button>
                  {onSettings != null && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={HEAD_ICON_BTN_CLS}
                      aria-label={t('总管设置')}
                      onClick={onSettings}
                    >
                      <ChiefGear />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={HEAD_ICON_BTN_CLS}
                    aria-label={t('关闭')}
                    onClick={onClose}
                  >
                    <X width={16} height={16} />
                  </Button>
                </div>
              </div>
              {/* 模型行（旧 .chief-model 等值：12px tertiary、gap 5、3 上距）。
                  #615 A/B：显示行翻控制件——行首 = 运行时标记（FAB / 消息流的
                  Agent 头像脸不受影响，XMON-105 律），点开 = 主模型覆盖锚定
                  弹层（#751：贴行底下，家族律见 ChiefModelPopover；live
                  PATCH 落库回显）。wrap 只承布局（-4px 光学内缩），定位正本
                  在 Popover Positioner。中和件同头部 chip 族：h-auto/
                  leading-[inherit]/font-normal 防原语定值撑高 12px 行、
                  hover 底/墨 = 旧 per-face 配方（surface-secondary +
                  secondary 墨）、svg size-auto（ChevronDown 12 属性尺寸）。 */}
              <div className="mt-[3px] flex items-center gap-[5px] text-xs text-(--text-tertiary)">
                {chief.bound ? (
                  <span className="relative block min-w-0 -ml-1">
                    <ChiefModelPopover
                      open={modelOpen}
                      onOpenChange={setModelOpen}
                      value={modelValue}
                      options={modelOptions}
                      onPick={onPickModel}
                      trigger={
                        <Button
                          variant="ghost"
                          className="h-auto min-w-0 max-w-full shrink cursor-pointer justify-start gap-[5px] rounded-none border-none bg-transparent px-1 py-px leading-[inherit] font-normal text-(--text-tertiary) hover:bg-(--secondary) hover:text-(--text-secondary) dark:hover:bg-(--secondary) aria-expanded:bg-transparent aria-expanded:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
                          aria-label={t('总管主模型')}
                        >
                          {/* #615 返工（用户裁决）：行首 = 运行时标记，不是 Agent 头像
                          ——标记正本 = 参考站 providers 运行时 tab 的 SVG（用户指认
                          /app/resources/providers?runtime=pi 面，DOM 捕获入库）：
                          pi = RuntimePi 块状 π，claude-code = RuntimeClaudeCode
                          品牌星标（填色随捕获）。FAB / 消息流的 Agent 头像脸不受
                          影响（XMON-105 律在其各自面继续生效）。 */}
                          <span className="inline-flex flex-none items-center">
                            {(chief.modelProvider ?? 'pi') === 'claude-code' ? (
                              <RuntimeClaudeCode width={12} height={12} />
                            ) : (
                              <RuntimePi width={12} height={12} />
                            )}
                          </span>
                          <span className="min-w-0 truncate">{chief.modelSlot}</span>
                          <ChevronDown width={12} height={12} />
                        </Button>
                      }
                    />
                  </span>
                ) : (
                  <span>n/a</span>
                )}
              </div>
              {threadsOpen && (
                // 主题切换器（r5 116，旧 .chief-switcher 等值：头部锚定绝对
                // 位、262 宽、popover 底、drawer-local z 5——#688 阶梯外，
                // 收编于抽屉 stacking context 只压内部内容）。
                <div
                  className="absolute top-8 left-3 z-[5] w-[262px] rounded-none bg-(--popover) p-1 shadow-(--chief-shadow)"
                  role="menu"
                >
                  {(chief.threads ?? []).map((thread, index) => (
                    // #950 裸控件收编：行钮 = Button ghost + 七通道归零（旧
                    // .chief-switcher-row 等值：30 行 / 13px 次级墨 / 方角
                    // 透明底）；当前主题态载体 = aria-current（旧 .is-active
                    // 类退役，#910 裁定 3——surface-hover 底随条件挂）。
                    <Button
                      variant="ghost"
                      role="menuitem"
                      key={thread.title}
                      aria-current={thread.active ? 'true' : undefined}
                      className="h-[30px] w-full cursor-pointer justify-start gap-2 rounded-none border-none bg-transparent px-2 text-left text-[13px] font-normal text-(--text-secondary) hover:bg-transparent hover:text-(--text-secondary) dark:hover:bg-transparent aria-expanded:bg-transparent aria-[current=true]:bg-(--secondary) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
                      onClick={
                        onThread != null
                          ? () => {
                              onThread(thread.title, index);
                              setThreadsOpen(false);
                            }
                          : undefined
                      }
                    >
                      <ChiefHash
                        width={11}
                        height={11}
                        className="flex-none text-(--text-tertiary)"
                      />
                      <span className="truncate">{t(thread.title)}</span>
                    </Button>
                  ))}
                </div>
              )}
            </header>

            {/* #651: 真滚动容器——auto 只在溢出时出滚动条；打字期贴底跟随归
                上方 useChatFollow（打开/切线程落底、近底才跟随）。 */}
            <div className="min-h-0 flex-1 overflow-y-auto" data-testid="chief-body" ref={bodyRef}>
              {!chief.bound && (
                <div className="mx-[17px] flex h-[54px] items-center rounded-none bg-(--secondary) pr-3 pl-5 text-[13px] text-(--text-secondary)">
                  <span>{t('请先为总管选择一个 Agent。')}</span>
                  {/* XMON-23 收编：default 档 = A3 primary 等价位。中和件对齐 A6 实测形（50×26、12px 字、
                  8px 内边距、8 圆角、400 字重）：h-[26px]/px-2/rounded-md/
                  border-0/font-normal + 既有 inline style；active 位移中和。 */}
                  <Button
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
                  {/* 旧 .chief-hero + gate 兄弟选择器等值：gate 在位（= 未
                      绑定）时上距 62，否则 54——条件类随 JSX 状态切换。 */}
                  <h2
                    className={`text-center text-[15px] font-semibold text-(--foreground) ${
                      chief.bound ? 'mt-[54px]' : 'mt-[62px]'
                    }`}
                  >
                    {t('选择一个主题开始')}
                  </h2>
                  <div
                    className="mx-[33px] mt-3 grid grid-cols-2 gap-2.5"
                    data-testid="chief-examples"
                  >
                    {chief.examples.map((ex) => {
                      const Icon = EXAMPLE_ICONS[ex.icon];
                      return (
                        // #146: 点击即发预置词进 chief 线程（live 面走 onSend，
                        // 等同用户键入发送；zh 权威 canon 串上行，r5 111 逐字）。
                        // #631：onSend 异步化（被拒保留 draft）后 hero 面消费
                        // fire-and-forget——失败 toast 归 surface，此处无 draft
                        // 可保，不悬挂未处理 promise。
                        // XMON-23→#950：ghost 原语 + 示例卡皮肤 utility（旧
                        // .chief-example 等值：64 卡 / 12 gap / surface-secondary
                        // 底）。中和件沿旧：justify-start/whitespace-normal/
                        // font-normal（原语居中+nowrap+medium 会破 170 卡内
                        // 左对齐换行文案）、hover 涂底钉回卡底（旧 unlayered
                        // 恒压件配方）、active 位移、svg size-auto（瓦片字形
                        // 14px 属性尺寸）。
                        <Button
                          variant="ghost"
                          className="h-16 w-full cursor-pointer justify-start gap-3 rounded-none border-none bg-(--secondary) px-3 text-left whitespace-normal font-normal hover:bg-(--secondary) dark:hover:bg-(--secondary) aria-expanded:bg-transparent active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
                          key={ex.text}
                          onClick={onSend != null ? () => void onSend(ex.text) : undefined}
                        >
                          <span className="flex size-6 flex-none items-center justify-center rounded-none bg-(--seg-active) text-(--text-tertiary)">
                            <Icon width={14} height={14} />
                          </span>
                          {/* 12px: r5 100 wraps 帮我组建 Agent 团/队 but keeps
                              帮我创建一个新项目 on one line inside the
                              170-wide card */}
                          <span className="text-xs leading-[21px] text-(--text-secondary)">
                            {t(ex.text)}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </>
              )}
              {chief.stream && (
                <div className="px-[17px] pt-3.5" data-testid="chief-stream">
                  {chief.stream.map((item, i) => {
                    // #631 失败行（chief_turn_error 投影）：居中 danger 提示 +
                    // 原因原文（server 数据，不经 t()——用户/agent 内容同律）。
                    if (item.kind === 'error')
                      return (
                        <div
                          key={i}
                          className="my-2.5 text-center text-xs text-(--destructive)"
                          role="alert"
                        >
                          {t('总管本轮执行失败')}
                          <span className="mt-0.5 block break-all text-(--text-tertiary)">
                            {item.text}
                          </span>
                        </div>
                      );
                    if (item.kind === 'note')
                      return (
                        <div key={i} className="my-2.5 text-center text-xs text-(--text-tertiary)">
                          {t(item.text)}
                          {item.machineName && (
                            <>
                              {/* r5 114：`运行在 … 上` 的机器名下划线。 */}
                              <span className="underline underline-offset-2">
                                {item.machineName}
                              </span>
                              {t('上')}
                            </>
                          )}
                        </div>
                      );
                    if (item.kind === 'user')
                      return (
                        <div key={i} className="mt-3.5 flex gap-2.5" data-testid="chief-msg">
                          {/* #650 / XMON-105: 用户行头像接全站单源——与详情页对话
                          用户行（transcript.tsx）逐字节同配方：avatarUrl 覆盖 >
                          dicebear 名字种子 > 静态兜底资产。原写死的
                          ChiefUserSolid 通用人形字形是全站最后一个漏网点。 */}
                          <span className={AVATAR_IMG_CLS}>
                            <SeededAvatar
                              className="size-6"
                              name={user.displayName}
                              src={user.avatarUrl}
                              fallback="/avatar-user.png"
                            />
                          </span>
                          <div className={MSG_COL_CLS} data-testid="chief-msg-col">
                            {/* #742：live 用户行的 markdown 槽（详情页用户行
                                transcript.tsx #612 同款配方）——经共用块级解析器
                                渲染，todo 提及 chip / 粗体 / 行内 code / 围栏不再
                                按字面漏出；md 形气泡首/尾块 margin 归零（上下
                                留白由 10px padding 承担，块自带 margin 不再叠出
                                双倍间距或尾部空转），纯文本槽（fixture 捕获形）
                                保持字面路径 DOM 与几何逐字不变。复制载荷照旧取
                                item.text 原文（#469 律），rewind 锚 id 透传不动。 */}
                            <div
                              data-testid="chief-bubble"
                              data-md={item.markdown != null ? '' : undefined}
                              className={
                                item.markdown != null
                                  ? `${BUBBLE_CLS} ${BUBBLE_MD_CLS}`
                                  : BUBBLE_CLS
                              }
                            >
                              {item.markdown != null ? (
                                <ChatMarkdown text={item.markdown} />
                              ) : (
                                item.text
                              )}
                            </div>
                            <div
                              className="mt-[7px] flex gap-2.5 text-(--text-tertiary)"
                              data-testid="chief-msg-tools"
                            >
                              {/* #615 C：复制翻真 clipboard 钮（local-first 面存在）。 */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className={MSG_TOOL_BTN_CLS}
                                aria-label={t('复制')}
                                onClick={() => copyText(`u${i}`, item.text)}
                              >
                                {copiedKey === `u${i}` ? (
                                  <Check width={13} height={13} />
                                ) : (
                                  <Copy width={13} height={13} />
                                )}
                              </Button>
                              {/* #615 返工（用户裁决覆盖 #306 二分律）：恢复钮闭环
                              ——aria 正词「恢复到此处」= 参考站 live 同名控件；
                              语义 = rewind 锚（截断锚后消息 + 新会话重发该条，
                              server POST chief threads rewind）。破坏性 → 确认
                              层先行；fixture 面（onRewind 缺省 / id 缺省）走
                              accept 律关窗零请求。 */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className={MSG_TOOL_BTN_CLS}
                                aria-label={t('恢复到此处')}
                                onClick={() => setRewindConfirm({ index: i, id: item.id ?? null })}
                              >
                                <Restore width={13} height={13} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    // #955 思考段行：与 robot 行同槽（绑定身份脸 / 未绑定虚线 chief 字形）+
                    // 折叠式思考体，无 foot（思考不参与复制/恢复）。
                    // #1033：本行与工具行是 chief.css 退役（#950）后仅存的两处
                    // 死类名残留——骨架接回 robot/streaming 行同一套原语
                    // （AVATAR_IMG_CLS / AVATAR_SLOT_CLS / MSG_COL_CLS，行几何
                    // mt-3.5 flex gap-2.5）。`chief-msg` 类名保留：e2e 用它当
                    // 选择器（chief-stream-markdown.spec F-R19/R20）。
                    if (item.kind === 'thinking')
                      return (
                        <div key={i} className="chief-msg mt-3.5 flex gap-2.5">
                          {chief.bound && chief.agent ? (
                            <span className={AVATAR_IMG_CLS}>
                              <SeededAvatar
                                className="size-6"
                                name={chief.agent.displayName}
                                src={chief.agent.avatarUrl}
                                fallback="/avatar-robot-1.svg"
                              />
                            </span>
                          ) : (
                            <ChiefFaceDashed width={24} height={24} className={AVATAR_SLOT_CLS} />
                          )}
                          <div className={MSG_COL_CLS} data-testid="chief-msg-col">
                            <ThinkingRow text={item.text} />
                          </div>
                        </div>
                      );
                    // #955 流式期工具行：mapper 只在回合在飞（activeRun 非空）时
                    // 产出，与文本段按序交错；收口后回到 robot 行的折叠面。
                    // #1033：同思考行——骨架接回原语，`chief-msg` 类名保留。
                    if (item.kind === 'tool')
                      return (
                        <div key={i} className="chief-msg mt-3.5 flex gap-2.5">
                          <span className="w-6 shrink-0" aria-hidden="true" />
                          <div className={MSG_COL_CLS} data-testid="chief-msg-col">
                            <ToolActivityRow
                              name={item.label}
                              {...(item.startedAt !== undefined
                                ? { startedAt: item.startedAt }
                                : {})}
                              {...(item.seconds !== undefined ? { seconds: item.seconds } : {})}
                              {...(item.running !== undefined ? { running: item.running } : {})}
                              {...(item.error !== undefined ? { error: item.error } : {})}
                            />
                          </div>
                        </div>
                      );
                    // #739 在飞存在行：回合在飞但首 token 未至的静默窗口——头像槽
                    // 复用 robot 行的 agent 身份脸（bound = 绑定 Agent，未 bound =
                    // 虚线 chief 字形），右侧 = loading-dev Atom + `处理中...`，与
                    // 详情页对话区 streaming 行同一套词汇（transcript.tsx 正典）。
                    // 不挂秒数（#471），首 delta 到达即被 typing 行取代。
                    if (item.kind === 'streaming')
                      return (
                        <div key={i} className="mt-3.5 flex gap-2.5" data-testid="chief-msg">
                          {chief.bound && chief.agent ? (
                            <span className={AVATAR_IMG_CLS}>
                              <SeededAvatar
                                className="size-6"
                                name={chief.agent.displayName}
                                src={chief.agent.avatarUrl}
                                fallback="/avatar-robot-1.svg"
                              />
                            </span>
                          ) : (
                            <ChiefFaceDashed width={24} height={24} className={AVATAR_SLOT_CLS} />
                          )}
                          {/* #873：行骨架/展开律/走秒律全部收进共享 LiveRow
                          （components/chat/live-row）——与详情页 streaming 行
                          同一份行为源。本面只提供皮肤（SKIN.chief utility，
                          #950 起住 live-row 本体）与展开面内容（#822 的过程
                          披露：正在调用的工具 + 本轮已落库工具行）。
                          秒数不挂：本面没有真实起点（activeRun 封套不带时间戳），
                          没有起点就不摆数字（#471 律），而不是摆一个冻结的数。 */}
                          <div className="flex min-w-0 flex-1 flex-col">
                            <LiveRow
                              variant="chief"
                              label={item.label}
                              labelVars={item.labelVars}
                              disclosure={{ expand: '展开实时步骤', collapse: '收起实时步骤' }}
                            >
                              <div className={TURN_TOOLS_CLS} data-testid="chief-turn-tools">
                                {chief.runningTool != null && (
                                  <div className={TURN_TOOL_ROW_CLS}>
                                    <span className={TURN_TOOL_NAME_CLS}>
                                      {t('正在调用 {n}', { n: chief.runningTool })}
                                    </span>
                                  </div>
                                )}
                                {item.tools?.map((tool, k) => (
                                  <div key={k} className={TURN_TOOL_ROW_CLS}>
                                    <span className={TURN_TOOL_NAME_CLS}>{tool.label}</span>
                                    {tool.seconds !== undefined && (
                                      <span className="flex-none">{tool.seconds}s</span>
                                    )}
                                    {tool.error === true && (
                                      <span className="flex-none text-(--destructive)">
                                        {t('失败')}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {/* 兜底行 = 零信号窗口的存在证明（#739）；
                                    #905 活动信号在位时行首标签已给出相位，
                                    兜底行退场避免语义重复（interface-review
                                    收尾发现）。 */}
                                {chief.runningTool == null &&
                                  (item.tools?.length ?? 0) === 0 &&
                                  item.signalAt == null && (
                                    <div className={TURN_TOOL_ROW_CLS}>
                                      <span className={TURN_TOOL_NAME_CLS}>
                                        {t('等待 Agent 响应…')}
                                      </span>
                                    </div>
                                  )}
                                {/* #905：最近信号新鲜度与详情披露面同源
                                    （LiveSignal 走表）；无信号不渲染该行。 */}
                                {item.signalAt != null && (
                                  <div className={TURN_TOOL_ROW_CLS}>
                                    <LiveSignal at={item.signalAt} className={TURN_TOOL_NAME_CLS} />
                                  </div>
                                )}
                              </div>
                            </LiveRow>
                          </div>
                        </div>
                      );
                    // XMON-105: a bound chief answers as its agent — the stream
                    // row carries that agent's identity; unbound keeps the dashed
                    // chief glyph. #741: the bound identity is a chip (avatar +
                    // name, whole chip → the agent's settings page) heading the
                    // row, content full-width below it (reference assistant-
                    // message form) — the row flips to a column. The dashed form
                    // keeps the old side-avatar slot, byte-identical DOM.
                    const identity =
                      chief.bound && chief.agent ? <ChiefIdentity agent={chief.agent} /> : null;
                    return (
                      // #741：绑定形行翻列（identity chip 头 + 全宽正文，参考站
                      // assistant-message 形）；虚线未绑定形保持侧头像槽，
                      // DOM 逐字不变。gap：identity 形 6（[设计] 2/7/10 档中值），
                      // 侧头像形 10。
                      <div
                        key={i}
                        data-testid="chief-msg"
                        className={
                          identity != null ? 'mt-3.5 flex flex-col gap-1.5' : 'mt-3.5 flex gap-2.5'
                        }
                      >
                        {identity ?? (
                          <ChiefFaceDashed width={24} height={24} className={AVATAR_SLOT_CLS} />
                        )}
                        <div className={MSG_COL_CLS} data-testid="chief-msg-col">
                          {item.markdown != null ? (
                            // #650: live 回复原文走共用块级解析器（chat-markdown，
                            // transcript robot 行 #469 同律）——bold / 行内 code /
                            // mention / 列表 / 代码栅栏与详情页同形；抽屉节奏
                            // （14px/24px、段距 2px）由 MSG_COL_CLS 的容器
                            // inheritance + scoped 覆盖承载（正本注释见常量）。
                            // #651 typing 尾行同源同渲染——增量面与终稿面同形，
                            // 收敛不跳变。
                            <ChatMarkdown text={item.markdown} />
                          ) : (
                            <>
                              {(item.paragraphs ?? []).map((p, j) => (
                                <p
                                  key={j}
                                  className={
                                    j > 0 ? 'mt-0.5 text-sm leading-6' : 'text-sm leading-6'
                                  }
                                >
                                  <Segments segments={p} />
                                </p>
                              ))}
                              {item.bullets?.map((b, j) => (
                                <p
                                  key={`b${j}`}
                                  className="mt-0.5 flex gap-[7px] text-sm leading-6"
                                >
                                  <span className="flex-none">•</span>
                                  <span>
                                    <Segments segments={b} />
                                  </span>
                                </p>
                              ))}
                            </>
                          )}
                          {/* #651: typing 打字面是未定稿行——foot（复制/完成/过程
                          折叠）只属定稿行，打字行不渲染。 */}
                          {item.typing !== true && (
                            <div
                              className="mt-[9px] flex items-center gap-[7px] text-xs text-(--text-tertiary)"
                              data-testid="chief-msg-foot"
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className={MSG_TOOL_BTN_CLS}
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
                              {item.seconds !== '' && (
                                <span>{t('完成 {n}', { n: item.seconds })}</span>
                              )}
                              {/* #615 返工（用户裁决覆盖 #306 二分律）：foot 折叠箭头
                            闭环 = 该回合过程披露（Multica OuterProcessFold 同
                            族：chevron + 展开内容 = 工具步；r5 114 捕获位 = 完
                            成 Ns 之后的 ›）。展开面 = 被流主呈现滤掉的工具调
                            用行（chief_message toolcall 投影，DB 既有零新后端）；
                            无工具行的回合不渲染触发器（无可披露内容）。 */}
                              {(item.tools?.length ?? 0) > 0 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={MSG_TOOL_BTN_CLS}
                                  aria-label={toolsOpen.has(i) ? t('收起过程') : t('展开过程')}
                                  aria-expanded={toolsOpen.has(i)}
                                  onClick={() =>
                                    setToolsOpen((cur) => {
                                      const next = new Set(cur);
                                      if (next.has(i)) next.delete(i);
                                      else next.add(i);
                                      return next;
                                    })
                                  }
                                >
                                  {toolsOpen.has(i) ? (
                                    <ChevronDown width={11} height={11} />
                                  ) : (
                                    <ChevronRight width={11} height={11} />
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                          {(item.tools?.length ?? 0) > 0 && toolsOpen.has(i) && (
                            <div className={TURN_TOOLS_CLS} data-testid="chief-turn-tools">
                              {item.tools?.map((tool, k) => (
                                <div key={k} className={TURN_TOOL_ROW_CLS}>
                                  <span className={TURN_TOOL_NAME_CLS}>{tool.label}</span>
                                  {tool.seconds !== undefined && (
                                    <span className="flex-none">{tool.seconds}s</span>
                                  )}
                                  {tool.error === true && (
                                    <span className="flex-none text-(--destructive)">
                                      {t('失败')}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* #948：strip 的流内垫规则自 attachment-strip.css 迁入（该文件
                退役）——composer 卡在流内，strip 垫 8px 骑在输入与工具栏之间。
                #950：旧 .chief-composer 皮肤等值 utility（#775：--edge-ring
                发丝环 + card-shadow 卡级抬升，双主题随 token）。类名
                chief-composer 以零规则钩子存活：#948 把外域规则内联进本 div
                后，余下消费者 = spec 容器 scope（chief-panel.spec 的
                composer bar 定位）；摘除归 #952 终账。 */}
            <div className="chief-composer [&>.attachment-strip]:mt-2 mx-[17px] my-2.5 rounded-none bg-(--secondary) px-3 pt-3 pb-2.5 shadow-[var(--edge-ring),var(--card-shadow)] transition-shadow duration-(--dur-fast) ease-(--ease-out)">
              {/* #624：占位双态随回合态（r5 §3.6，截图 113）——活动线程 activeRun
              在位（chief.running，mapChief 单点投影）= steer canon「执行过程中
              即可送达」，空闲 / 新主题 / 回合收尾 = 空闲 canon。两值经 t() 消费
              shared 单源常量，抽屉文件零 CJK 占位字面量（en 键由
              i18n-coverage COMPUTED_KEYS 钉住）；刷新节奏骑既有
              invalidateAll / conversation SSE 重取，无新增轮询。 */}
              <div className="relative">
                {/* #732：textarea 皮肤照 detail composer 同款 combobox 律——内联
                listbox 开窗时报 combobox + 指向高亮行（DOM 焦点恒在框内，
                listbox 行不可聚焦）；caret-only 移动重判 token（change 事件
                覆盖不到那些）；fixture 静态面 editable=off → wire 重判永不发动。
                包层 = listbox 的 absolute 锚（relative；detail composer
                .composer-input-wrap 同律）。
                #950 裸控件收编：Textarea 件 + XMON-102/#860 尺寸律 utility
                （3 行 60px 基座、内容增高至 120px 上限由 wire growCap 的
                inline height 承载、超限盒内滚动，布局不抖）；件的
                field-sizing/边框/焦点环就地并掉（旧面 outline:none——输入
                焦点环缺席是既有形态，环律由全局 base 层承接与否随件皮肤
                显式归零）。e2e 载体 = data-testid（#910 二级：role 随补全
                开合在 textbox/combobox 间翻转、placeholder 随回合态双值，
                语义 locator 不稳）。 */}
                <Textarea
                  ref={attachComposer}
                  data-testid="chief-composer-input"
                  className="h-[60px] max-h-[120px] min-h-0 resize-none overflow-y-auto rounded-none border-none bg-transparent p-0 font-sans text-[13px] leading-5 text-(--foreground) tabular-nums shadow-none field-sizing-fixed placeholder:text-(--text-tertiary) focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none dark:bg-transparent"
                  readOnly={onSend == null}
                  value={wire.draft}
                  onChange={wire.handleChange}
                  onKeyDown={wire.handleKeyDown}
                  // #732：剪贴板图片/文件走 #310 attachFile 链（纯文本粘贴永不
                  // 进 preventDefault，detail composer 同律）。
                  onPaste={handlePaste}
                  onKeyUp={handleCaretMoved}
                  onClick={handleCaretMoved}
                  onSelect={handleCaretMoved}
                  onCompositionEnd={handleCompositionEnd}
                  onBlur={handleBlur}
                  placeholder={t(
                    chief.running === true
                      ? CHIEF_INPUT_PLACEHOLDER_STEERING
                      : CHIEF_INPUT_PLACEHOLDER,
                  )}
                  {...(inlineOpen
                    ? {
                        role: 'combobox',
                        'aria-expanded': true,
                        'aria-controls': inlineListboxId,
                        'aria-autocomplete': 'list' as const,
                      }
                    : slashOpen
                      ? {
                          role: 'combobox',
                          'aria-expanded': true,
                          'aria-controls': slashListboxId,
                          'aria-autocomplete': 'list' as const,
                        }
                      : {})}
                  {...(inlineOpen && inlineHighlight != null
                    ? { 'aria-activedescendant': `${inlineListboxId}-opt-${inlineHighlight}` }
                    : slashOpen && slashHighlight != null
                      ? { 'aria-activedescendant': `${slashListboxId}-opt-${slashHighlight}` }
                      : {})}
                />
                {/* #732：@ 内联 listbox（detail composer 同皮；mention-picker.css
                的 z-40 阶梯 = 宿主 drawer stacking context 内局部压住 composer）。 */}
                <MentionInline
                  open={inlineOpen}
                  rows={inlineRows}
                  caret={inlineCaret}
                  query={inlineQuery}
                  highlight={inlineHighlight}
                  onHover={setInlineHighlight}
                  onPick={(row) => {
                    if (row.kind === 'file') {
                      insertFile(row.label);
                    } else {
                      // #848: every entity kind inserts through serializeMention.
                      insertToken({
                        kind: row.kind,
                        id: row.id,
                        label: row.label,
                        ...(row.seq !== undefined ? { seq: row.seq } : {}),
                      });
                    }
                  }}
                  listboxRef={inlineListboxRef}
                  listboxId={inlineListboxId}
                />
                {/* #841 `/` slash menu（detail composer 同皮同锚：包层
                .chief-composer-input-wrap 即 relative 锚，行不可聚焦、DOM
                焦点恒在框内；Click = Enter-with-highlight 语义）。 */}
                <SlashMenu
                  open={slashOpen}
                  sections={slashSections.map((s) => ({
                    title: s.section === 'builtin' ? t('命令') : t('技能'),
                    rows: s.rows,
                  }))}
                  caret={slashCaret}
                  query={slashQuery}
                  highlight={slashHighlight}
                  onHover={setSlashHighlight}
                  onPick={(row) => acceptSlashRow(row, 'enter')}
                  listboxRef={slashListboxRef}
                  listboxId={slashListboxId}
                />
              </div>
              {/* #757 附件 strip（detail composer 同件：在途占位 + 落定 chip，
              可点预览）。chief composer 卡是 in-flow 布局，strip 走流式、
              空时零节点。 */}
              <AttachmentStrip draft={wire.draft} pending={pendingAttachments} />
              {/* deliberate-native（#855）：隐藏的文件选择触发器
                  （display:none，编程式打开），可见皮肤在附件 Button 上；
                  Input 原语是可见输入框皮肤，此处无可收编之物。 */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={onPickFiles}
                // 客户端 mime 守门（与服务层 ALLOWED_MIME_* 镜像，detail
                // composer 同值）；note accept 只是 hint，最终由 server 强拒兜底。
                accept="text/*,image/*,application/json,application/pdf,application/xml"
              />
              <div className="mt-2.5 flex items-center gap-4">
                {/* #732（#146 隐藏裁决翻案）：附件 + 提及开闸渲染（detail composer
                同款交互面，无新后端面）。语音输入维持 wontfix 不渲染（#304 C5）。
                fixture 面：onAttachment 缺省 → 附件钮惰性 disabled（件配方
                opacity-50/pointer-events-none 即 canon）；mentionGroups
                空 → popover 零计数开面（wire EMPTY_GROUPS 律）。 */}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('添加附件')}
                  className={TOOL_BTN_CLS}
                  disabled={attaching || onAttachment == null}
                  onClick={openFilePicker}
                >
                  <Paperclip width={16} height={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('提及')}
                  className={TOOL_BTN_CLS}
                  onClick={togglePicker}
                >
                  <Grid2x2 width={16} height={16} />
                </Button>
                {/* XMON-23→#950：ghost/icon 原语；实底双态（seg-active 歇 /
                card-button 亮）utility 化随 draft 条件切（旧 .is-on 状态类
                退役——态正本在 wire.draft，无需 DOM 载体）。rounded-md =
                旧 .btn 的 8 圆角档随件；border-0 防原语 1px transparent 边 +
                bg-clip-padding 在实底外圈切出 1px 缝（像素对拍实测）；
                ArrowUp 16px = 原语 size-4 同值。 */}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('发送')}
                  className={wire.draft !== '' ? `${SEND_BTN_CLS} ${SEND_ON_CLS}` : SEND_BTN_CLS}
                  onClick={wire.send}
                >
                  <ArrowUp width={16} height={16} />
                </Button>
              </div>
              {/* #732：提及 popover（detail composer 同皮；壳 FloatingShell 非模态
              Dialog，Esc 走 Base UI layer 栈只收顶层——drawer 侧的 #146 分层律
              不受扰）。 */}
              <MentionPicker
                open={pickerOpen}
                onClose={closePicker}
                groups={groups}
                onInsert={(tokens) => {
                  insertTokens(tokens);
                  closePicker();
                }}
              />
              {/* #841 `/help` panel（detail composer 同件：当前可用 builtins
              只读一览）。 */}
              <SlashHelp
                open={helpOpen}
                onClose={closeHelp}
                commands={helpRows}
                skillCount={helpSkillCount}
              />
            </div>
            {/* #615 返工：恢复钮确认层（破坏性：截断锚后消息并以锚重发）。壳与
            按钮档复用 chief-agent-dialog 同族配方（#950 后 = §5.4 容器
            utility + outline/default 件正典 + px-3/text-[13px] 内联档）。
            fixture 面 id 缺省 = accept 律关窗零请求。 */}
            <DialogShell
              title={t('恢复到此处')}
              open={rewindConfirm !== null}
              onClose={() => setRewindConfirm(null)}
              footer={
                <div className="flex flex-col px-4 pb-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      className="px-3 text-[13px]"
                      onClick={() => setRewindConfirm(null)}
                    >
                      {t('取消')}
                    </Button>
                    <Button
                      className="px-3 text-[13px]"
                      onClick={() => {
                        const anchor = rewindConfirm;
                        setRewindConfirm(null);
                        if (anchor?.id != null) onRewind?.(anchor.id);
                      }}
                    >
                      {t('恢复到此处')}
                    </Button>
                  </div>
                </div>
              }
            >
              <div className="flex flex-col gap-4 p-4">
                <p className="text-[13px] leading-5 text-(--foreground)">
                  {t('恢复到此处？该条之后的 {n} 条消息会移除，总管从这条重发开新回合。', {
                    n: Math.max(0, (chief.stream?.length ?? 0) - (rewindConfirm?.index ?? 0) - 1),
                  })}
                </p>
              </div>
            </DialogShell>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  );
}
