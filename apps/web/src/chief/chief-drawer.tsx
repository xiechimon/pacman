// Chief window (issue #72; form re-ruled by ADR 0013, superseding the
// #447/ADR 0004 docked column): the 总管面板 is a Multica-style floating
// window — 380×600 anchored 8px from the content area's bottom-right
// corner, radius 12px, opaque card ground, --floating-shadow, non-modal,
// no scrim. It is an overlay again, not a layout citizen: nothing yields
// (0004 D2/D7/D8 retired), the root layout hosts the single persistent
// instance (chief-root.tsx, D6), and closing minimizes — Base UI
// keepMounted parks the popup `hidden` in the DOM with the draft, scroll
// and thread state intact. Header = thread chip + model row + icon
// buttons (Minimize, no X — D3); body = gate bar (unbound) or hero
// examples / thread message flow; composer pinned at the bottom. The
// switcher popover (116) and the view swap to 总管设置 are real state so
// the surface is clickable in dev; fixture captures never click, so the
// fixture alone decides the captured state.
// 文件名/标识符 chief-drawer 是 ADR 0013 D13 记录的残留（GLOSSARY avoid
// 列），更名随 #1009 A0 施工面统一走，原型阶段不动（e2e/探针载体重钉同批）。
// #615 四连报闭环：模型行由纯显示 span 翻成控制件（button → 主模型覆盖
// dialog，PATCH chief model 槽落库回显）；行首 = 运行时标记（pi 出 RuntimePi
// 块状 π、claude-code 出 RuntimeClaudeCode 品牌星标——正本 = 参考站
// providers 运行时 tab SVG，用户返工裁决：要运行时 SVG 不要 Agent 头像；
// FAB / 消息流的 Agent 头像脸在各自面继续生效）；消息行复制
// glyph 翻真 clipboard 钮（local-first 面存在），恢复/foot 折叠 chevron 无
// 后端面按 #306/#146 二分律移除不渲染；gear 各族可达（非 board 面落 board
// 设置视图深链，根 host 兜底后结构上恒在——chief-root.tsx 的 onSettings
// 路由分派，ADR 0013 D9）。
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
// 律，composer 聚焦时 n 归打字员）；钮载 Tooltip+Kbd 的 N 悬浮提示（below 落位）
// + aria-keyshortcuts；键与钮同 handler（触发 + 收切换器 popover）。

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  CHIEF_INPUT_PLACEHOLDER,
  CHIEF_INPUT_PLACEHOLDER_STEERING,
  type ChiefCompactionModel,
} from '@pacman/shared';
import {
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { attachFile } from '../api/attachments.js';
import { useMachines, useMembers, useProjects, useSkills, useTodos } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { ThinkingRow, ToolActivityRow } from '../components/chat/agent-rows.js';
import { LiveRow, LiveSignal } from '../components/chat/live-row.js';
import { Bubble, BubbleContent } from '../components/ui/bubble.js';
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { Kbd } from '../components/ui/kbd.js';
import { Marker, MarkerContent } from '../components/ui/marker.js';
import { Message, MessageContent } from '../components/ui/message.js';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from '../components/ui/message-scroller.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { Textarea } from '../components/ui/textarea.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip.js';
import { ChatMarkdown } from '../detail/chat-markdown.js';
import type { ChiefContent, ChiefSegment, ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import {
  ArrowDown,
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
  Minus,
  Paperclip,
  Plus,
  Restore,
  RuntimeClaudeCode,
  RuntimePi,
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

/** 悬浮窗壳（ADR 0013 D2/D10：几何皮肤整套采 Multica 原值——默认
 *  380×600、距内容区右/下各 8px、圆角 12px、--floating-shadow、不透明卡底
 *  非玻璃、无模态无 scrim；包含块 = 视口（内容区铺满视口右缘，侧栏在左，
 *  「不压侧栏」由角落锚定自然成立）。发丝环走仓内 #139 正典 --edge-ring
 *  （inset shadow spread，分数缩放不断线）与投影合成一条 shadow。z 档 =
 *  --z-floating 新 rung（#688 律：常驻伴随面压 in-flow 内容、让位一切
 *  活动层）。max-w/max-h 夹取 = 视口小于窗时的可用性护栏（非形态分支，
 *  D2「窄窗不做特殊形态」的边界兜底）。圆角走 --radius-window token
 *  （A0 实审裁决 3 提 token；值 = Multica rounded-xl 12px 原值，不消费
 *  #983 退役面的 --radius-popover，ADR 0012 D4 明令）；窗是唯一消费点。
 *  类名 chief-drawer 保留为零规则机制钩子：
 *  overlays/hotkeys.ts 的 ⌘J 守卫走 closest('.chief-drawer')，e2e 以它做
 *  面板 scope 锚（更名随施工面载体重钉批，D13）。 */
const WINDOW_CLS =
  'chief-drawer fixed right-2 bottom-2 z-(--z-floating) flex h-[600px] max-h-[calc(100dvh-1rem)] w-[380px] max-w-[calc(100dvw-1rem)] flex-col overflow-hidden rounded-(--radius-window) bg-(--card) shadow-[var(--edge-ring),var(--floating-shadow)]';

/** 进出场腿（ADR 0013 D7：fade + scale 0.95→1、transformOrigin bottom
 *  right——窗从 FAB 角长出；shadcn/Base UI 默认动效家族（dropdown/popover
 *  同款 animate-in/out + fade/zoom-95 词表），零自定义曲线（ADR 0009 收敛
 *  律），时长走 --dur-overlay 200ms（Multica 实测 scale 0.2s 同值）；
 *  0004 D4 的 translateX 滑入退役。reduced-motion 降级走 motion.css 全站
 *  法（tw-animate-css keyframe 含）。 */
const WINDOW_MOTION_CLS =
  'origin-bottom-right duration-(--dur-overlay) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95';

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
const BUBBLE_MD_CLS = '[&>:first-child]:mt-0! [&>:last-child]:mb-0!';

/** #1009 A1：chat 原语换装的消费点中和配方（五件原语文件保持 pristine——
 *  registry 账本 hash 零触碰，中和全走消费点 className/style）。滚动模型 =
 *  MessageScroller 原生 autoScroll（#873 跟随律的原语实现，阈值 80px 同值、
 *  发送跳最新 scrollToEnd、开窗关武装——Provider 注记见壳层）。Item 的
 *  [content-visibility:auto] 用 inline style 钉回 visible：离屏行不跳布局，
 *  e2e 可见性断言与探针几何采样不随滚动相位漂（determinism 优先于虚拟化
 *  收益——380px 窗数十行的规模）。 */
const SCROLLER_ITEM_STYLE: CSSProperties = { contentVisibility: 'visible' };
const SCROLLER_ROOT_CLS = 'h-auto min-h-0 flex-1';
/** Content 的 block + gap-0：行距语义保持在行自身的 margin 上（现状
 *  mt-3.5 / my-2.5 的块级折叠律逐字存活），原语默认 flex gap-6 会双倍行距。 */
const SCROLLER_CONTENT_CLS = 'block gap-0 px-[17px] pt-3.5';
/** 行骨架中和：Message 原语默认（gap-2）钉回现行行几何；identity chip
 *  列形 = flex-col gap-1.5（#741 参考站 assistant-message 形原值）。 */
const MSG_ROW_CLS = 'mt-3.5 gap-2.5';
const MSG_ROW_IDENTITY_CLS = 'mt-3.5 flex-col gap-1.5';
const MSG_COL_MID_CLS = `${MSG_COL_CLS} gap-0`;
const MSG_COL_LIVE_CLS = 'min-w-0 flex-1 gap-0';
/** Bubble 默认皮几何中和（票面）。user 行 = secondary 档：--secondary 底
 *  即原 BUBBLE_CLS 槽位、--secondary-foreground 双主题与 --foreground 等值
 *  （#1002 色板实测同值）；几何钉回原值（radius-popover / px-3 py-2.5 /
 *  leading-6 / 满列宽——原语 80% cap 与 w-fit 随现状面中和）。robot 行 =
 *  ghost 档：裸文本面，结构走原语、皮肤零（p-0/bg-transparent 由 ghost
 *  档父选择器承载，消费点只补 leading-6 与满宽）。 */
const BUBBLE_WRAP_CLS = 'w-full max-w-full';
// border-0：BubbleContent 原语自带 border border-transparent（不可见但吃
// 2px 几何——F-R16 的 44px 药丸 canon 是零边框面值），中和面逐像素对齐。
const BUBBLE_USER_CLS = 'w-full rounded-(--radius-popover) border-0 px-3 py-2.5 leading-6';
const BUBBLE_ROBOT_CLS = 'w-full border-0 leading-6';
/** note/error 的居中 annotation 行 = Marker 原语（上游用途本义）；字号/
 *  墨色钉回现状（text-xs + tertiary/destructive，原语 text-sm/muted 中和），
 *  error 二段面走 flex-col。 */
const MARKER_NOTE_CLS = 'my-2.5 justify-center text-center text-xs text-(--text-tertiary)';
const MARKER_ERROR_CLS = 'my-2.5 flex-col justify-center text-center text-xs text-(--destructive)';

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
  /** 常驻窗的开态旗（ADR 0013 D6）：关闭 = 最小化——Base UI keepMounted
   *  把窗以 hidden 停驻在 DOM，草稿/滚动/线程态全保；退场动画 outlives
   *  the minimize（transition-status）。 */
  open?: boolean;
  chief: ChiefContent;
  /** Opens 总管设置: board route = content swap (r5 101–104); 非 board 路由
   *  走 `?chief=settings` 深链导航（#615）——chief-root 单挂载点按路由分派
   *  （D9 设置面承载不变：内容交换，不进悬浮窗）。缺省 = 齿轮不渲染。 */
  onSettings?: () => void;
  /** 最小化（ADR 0013 D3 的唯一收起动作之一，另一个是 ⌘J）：窗退回右下
   *  角 FAB，不是销毁式关闭。 */
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

interface InnerProps extends DrawerProps {
  /** 主题切换器开态（壳层提升：Root onOpenChange 的 Esc 分层代收要读写它，
   *  内容列整体住 Provider 之下——同组件 hook 吃不到自己渲染树的 context）。 */
  threadsOpen: boolean;
  setThreadsOpen: Dispatch<SetStateAction<boolean>>;
}

export function ChiefDrawer(props: DrawerProps) {
  const { open = true, chief } = props;
  const { t } = useI18n();
  const [threadsOpen, setThreadsOpen] = useState(chief.threadsOpen ?? false);
  return (
    <DialogPrimitive.Root
      open={open}
      modal={false}
      // 外点不关（Multica 同律，0004 现状继承）；Esc **永不关面板**（ADR
      // 0013 D3——#146「分层第二按关抽屉」契约随贴右竖板退役，对 #168
      // dialog 家族关闭律的自觉背离照 #443 先例记 0013 D3），只收面板内层
      // 弹层：主题切换器在此代收，模型 popover 是 Base UI layer 栈自收。
      disablePointerDismissal
      onOpenChange={(next: boolean, details?: { reason?: string }) => {
        if (next) return;
        if (details?.reason === 'escape-key' && threadsOpen) setThreadsOpen(false);
      }}
    >
      {/* D6/D10：Portal 回 body（dock 行发现随让位退役），keepMounted 承载
          「关 = 在 DOM 但 inert」的常驻契约——Base UI 把关态 Popup 以
          hidden 属性停驻（tailwind preflight 的 [hidden] display:none
          !important 钉死 flex utility 的覆盖面），草稿/滚动/线程态全保；
          退场动画仍先播（transition-status），播完才落 hidden。「关」的
          可观测契约从「不在 DOM」改「在 DOM 但 hidden/inert」（D6，e2e
          count-0 断言族按 0012 D6 载体重钉，行为语义不变）。 */}
      <DialogPrimitive.Portal keepMounted>
        <DialogPrimitive.Popup
          // render 令 Popup 即 aside（悬浮窗本体）；fade+scale 进出场落在
          // aside 上，origin bottom-right = 窗从 FAB 角长出（D7）。
          render={<aside className={`${WINDOW_CLS} ${WINDOW_MOTION_CLS}`} aria-label={t('总管')} />}
          initialFocus={false}
          finalFocus={false}
        >
          {/* #1009 A1：MessageScroller Provider 包住整列窗内容——滚动律单源
              从 useChatFollow 换成原语原生 autoScroll，#873 语义逐条保留：
              贴底阈值 80px = FOLLOW_THRESHOLD 同值（scrollEdgeThreshold）、
              关窗解除武装 = 旧 active=open 同律（autoScroll）、打开落底 =
              chat 面通行律（defaultScrollPosition="end"）、发送跳最新 =
              scrollToEnd()（实审裁决 2：不采 scrollAnchor 逐条锚定）。
              消费点（composer wire 的 onSend 与切线程 effect）住内容列
              hook 里，必须整体下沉到 Provider 之下——拆分点即此。 */}
          <MessageScrollerProvider
            autoScroll={open}
            scrollEdgeThreshold={80}
            defaultScrollPosition="end"
          >
            <ChiefDrawerInner
              {...props}
              threadsOpen={threadsOpen}
              setThreadsOpen={setThreadsOpen}
            />
          </MessageScrollerProvider>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ChiefDrawerInner({
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
  threadsOpen,
  setThreadsOpen,
}: InnerProps) {
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
  const [modelOpen, setModelOpen] = useState(false);
  // #651 → #1009 A1 滚动模型替换：真滚动容器 = MessageScroller Viewport
  // （data-testid chief-body 载体随迁；overflowY auto 面由原语承载），贴底
  // 跟随/打开落底 = Provider 原生 autoScroll + defaultScrollPosition（壳层
  // 注记）；本层只剩「切线程落底」一条 effect——旧 useChatFollow 的
  // resetDep 语义等价迁移（threadTitle 变 = 换线程 = 落底看最新；标题守卫
  // 防无关重渲触发）。发送跳最新 = scrollToEnd（下方 wire.onSend）。
  // #1009 A2：详情页对话列也已换骑原语，useChatFollow 整件退役（#873 单源律
  // 由 MessageScroller 承接）。
  const { scrollToEnd } = useMessageScroller();
  const prevThreadRef = useRef(chief.threadTitle);
  useEffect(() => {
    if (prevThreadRef.current === chief.threadTitle) return;
    prevThreadRef.current = chief.threadTitle;
    if (open) scrollToEnd();
  }, [chief.threadTitle, open, scrollToEnd]);
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
    // （A1 起机制 = useMessageScroller().scrollToEnd，语义 = 旧
    // requestFollow 的「读者自己的发送恒赢」律），四个分流出口之外的通用
    // 发送面。
    onSend:
      onSend == null
        ? undefined
        : (text: string) => {
            scrollToEnd();
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
  // Esc 分层由 Base UI 壳代收（见下 onOpenChange）：Base UI 处理 Esc 时会
  // 拦下事件，窗口监听（旧 useEscapeClose）收不到。ADR 0013 D6 后不再有
  // dock 行发现——Portal 回 body，窗是 fixed 角落锚定（D10）。
  // #389 → ADR 0013 D5（MUL-5522 同律）：autofocus 只认 closed→open 迁移
  // ——持久化开态的加载（挂载即 open=true）不抢焦点；keepMounted 让节点
  // 常驻后，「OverlayMount 滞后一帧、首焦由 ref callback 承载」的旧径退役
  // （重开节点不脱离，迁移 effect 单点即可）。⌘J 热键呼出与 FAB 点击同路。
  const { textareaRef } = wire;
  const prevOpenRef = useRef(open);
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (!open || wasOpen) return;
    // keepMounted 关态 = hidden 驻 DOM：Base UI 摘 hidden 的提交时机晚于本
    // effect，focus() 打在 display:none 上静默失败（实测首焦全丢）——帧重试
    // 到节点脱离 [hidden] 祖先再落焦（有界 5 帧；中途关窗则 closest 命中
    // hidden 自然放弃）。
    let frames = 0;
    const tryFocus = () => {
      const node = textareaRef.current;
      if (node == null) return;
      if (node.closest('[hidden]') == null) {
        node.focus({ preventScroll: true });
        return;
      }
      if (frames < 5) {
        frames += 1;
        requestAnimationFrame(tryFocus);
      }
    };
    requestAnimationFrame(tryFocus);
  }, [open, textareaRef]);
  const attachComposer = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
    },
    [textareaRef],
  );
  // #645: N = 新主题（抽屉作用域裸键）——与头部 + 钮同一 handler（触发 + 收
  // 切换器 popover）。enabled 门 = 开态且 live 面（fixture 面钮惰性，键同惰）；
  // 守卫与输入冲突律归 hotkeys 模块（composer 聚焦时 n 归打字员）。
  const newThread = useCallback(() => {
    if (onNewThread == null) return;
    onNewThread();
    setThreadsOpen(false);
  }, [onNewThread]);
  useChiefNewThreadHotkey(open && onNewThread != null, newThread);
  // A1 拆分：Dialog 壳（Root/Portal/Popup/aside）与 MessageScroller Provider
  // 住外层 ChiefDrawer；本组件 = Provider 之下的整列窗内容（header/body/
  // composer/弹层），hook 面得以消费 useMessageScroller。
  return (
    <>
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
            {/* #645/#1008: N 悬浮提示（kbd-hint 族第四消费点）——kbd-hint
                  退役（#983 判决）→ 官网 Tooltip+Kbd 组合（A0 已在 chief-root
                  的 ⌘J 面移植同款，本钮随形）；side=bottom sideOffset=8 =
                  旧 below 落位（头部贴视口顶，above 会落屏外）。 */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`relative ${HEAD_ICON_BTN_CLS}`}
                    aria-label={t('新主题')}
                    aria-keyshortcuts="N"
                    onClick={onNewThread != null ? newThread : undefined}
                  />
                }
              >
                <Plus width={18} height={18} />
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <Kbd>N</Kbd>
              </TooltipContent>
            </Tooltip>
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
              // ADR 0013 D3：关闭模型对齐 Multica——唯一的收起动作是
              // Minimize（Minus 字形，最小化心智，无 X）；语义 = 窗退
              // 回右下角 FAB，面板状态全保留（GLOSSARY「最小化」正名，
              // 「关闭」在悬浮窗语境入 avoid 列）。⌘J 再按同收。
              aria-label={t('最小化')}
              onClick={onClose}
            >
              <Minus width={16} height={16} />
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
                <ChiefHash width={11} height={11} className="flex-none text-(--text-tertiary)" />
                <span className="truncate">{t(thread.title)}</span>
              </Button>
            ))}
          </div>
        )}
      </header>

      {/* gate / hero 移出滚动区（#1009 A1）：两面只在无流状态出场
                （未绑定 gate / 空线程 hero），移出后视觉等价；滚动区自此
                纯消息流。gate 在位（= 未绑定）时 hero 上距 62，否则 54
                ——条件类随 JSX 状态切换（旧 .chief-hero 兄弟选择器等值）。 */}
      {!chief.bound && (
        <div className="mx-[17px] flex h-[54px] flex-none items-center rounded-none bg-(--secondary) pr-3 pl-5 text-[13px] text-(--text-secondary)">
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
        <div className="flex-none">
          <h2
            className={`text-center text-[15px] font-semibold text-(--foreground) ${
              chief.bound ? 'mt-[54px]' : 'mt-[62px]'
            }`}
          >
            {t('选择一个主题开始')}
          </h2>
          <div className="mx-[33px] mt-3 grid grid-cols-2 gap-2.5" data-testid="chief-examples">
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
        </div>
      )}
      {/* #651 → #1009 A1 滚动模型替换：真滚动容器 = MessageScroller
                Viewport（原语 overflow-y-auto 承载 F-R6/R8 的 chief-body
                pin 面）；Root 中和 h-auto（原语 size-full 的 h-full 在
                header/composer 兄弟列里会顶爆 flex 链）；Content 中和
                block + gap-0（行距留在行 margin 上，注记见常量）。
                chief-body / chief-stream 两 testid 载体随迁。 */}
      <MessageScroller className={SCROLLER_ROOT_CLS}>
        <MessageScrollerViewport data-testid="chief-body">
          <MessageScrollerContent className={SCROLLER_CONTENT_CLS} data-testid="chief-stream">
            {chief.stream?.map((item, i) => {
              // #631 失败行（chief_turn_error 投影）：居中 danger 提示 +
              // 原因原文（server 数据，不经 t()——用户/agent 内容同律）。
              // #1009 A1：居中 annotation 行 = Marker 原语（上游用途
              // 本义）；role=alert 与二段面（提示 + 原因块）原样，字号
              // 墨色中和钉回现状（MARKER_ERROR_CLS 注记）。error 行无
              // 源 message id（system 行投影），key 走 index。
              if (item.kind === 'error')
                return (
                  <MessageScrollerItem key={i} style={SCROLLER_ITEM_STYLE}>
                    <Marker role="alert" className={MARKER_ERROR_CLS}>
                      <MarkerContent>{t('总管本轮执行失败')}</MarkerContent>
                      <span className="mt-0.5 block break-all text-(--text-tertiary)">
                        {item.text}
                      </span>
                    </Marker>
                  </MessageScrollerItem>
                );
              if (item.kind === 'note')
                return (
                  <MessageScrollerItem key={i} style={SCROLLER_ITEM_STYLE}>
                    <Marker className={MARKER_NOTE_CLS}>
                      <MarkerContent>
                        {t(item.text)}
                        {item.machineName && (
                          <>
                            {/* r5 114：`运行在 … 上` 的机器名下划线。 */}
                            <span className="underline underline-offset-2">{item.machineName}</span>
                            {t('上')}
                          </>
                        )}
                      </MarkerContent>
                    </Marker>
                  </MessageScrollerItem>
                );
              // #1009 A1：行骨架翻 Message 原语（头像列 + 内容列），气泡翻
              // Bubble secondary 档（--secondary 底 = 原 BUBBLE_CLS 槽位，
              // 几何中和钉回原值——BUBBLE_USER_CLS 注记）；A1 行 id 贯通后
              // key/messageId 走源 chief_message id（fixture 面缺省回落 index）。
              if (item.kind === 'user')
                return (
                  <MessageScrollerItem
                    key={item.id ?? i}
                    messageId={item.id}
                    style={SCROLLER_ITEM_STYLE}
                  >
                    <Message className={MSG_ROW_CLS} data-testid="chief-msg">
                      {/* #650 / XMON-105: 用户行头像接全站单源——与详情页对话
                          用户行（transcript.tsx）逐字节同配方：avatarUrl 覆盖 >
                          dicebear 名字种子 > 静态兜底资产。原写死的
                          ChiefUserSolid 通用人形字形是全站最后一个漏网点。
                          （A1：头像槽保持 recipes 单源 span——MessageAvatar 原语
                          自带 bg-muted/min-w-8 皮，中性化成本高于收益，A2 再裁。） */}
                      <span className={AVATAR_IMG_CLS}>
                        <SeededAvatar
                          className="size-6"
                          name={user.displayName}
                          src={user.avatarUrl}
                          fallback="/avatar-user.png"
                        />
                      </span>
                      <MessageContent className={MSG_COL_MID_CLS} data-testid="chief-msg-col">
                        {/* #742：live 用户行的 markdown 槽（详情页用户行
                                transcript.tsx #612 同款配方）——经共用块级解析器
                                渲染，todo 提及 chip / 粗体 / 行内 code / 围栏不再
                                按字面漏出；md 形气泡首/尾块 margin 归零（上下
                                留白由 10px padding 承担，块自带 margin 不再叠出
                                双倍间距或尾部空转），纯文本槽（fixture 捕获形）
                                保持字面路径 DOM 与几何逐字不变。复制载荷照旧取
                                item.text 原文（#469 律），rewind 锚 id 透传不动。 */}
                        <Bubble variant="secondary" className={BUBBLE_WRAP_CLS}>
                          <BubbleContent
                            data-testid="chief-bubble"
                            data-md={item.markdown != null ? '' : undefined}
                            className={`${BUBBLE_USER_CLS} ${
                              item.markdown != null ? BUBBLE_MD_CLS : ''
                            }`}
                          >
                            {item.markdown != null ? (
                              <ChatMarkdown text={item.markdown} />
                            ) : (
                              item.text
                            )}
                          </BubbleContent>
                        </Bubble>
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
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
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
                  <MessageScrollerItem
                    key={item.id ?? i}
                    messageId={item.id}
                    style={SCROLLER_ITEM_STYLE}
                  >
                    <Message className={`chief-msg ${MSG_ROW_CLS}`}>
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
                      <MessageContent className={MSG_COL_MID_CLS} data-testid="chief-msg-col">
                        <ThinkingRow text={item.text} />
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              // #955 流式期工具行：mapper 只在回合在飞（activeRun 非空）时
              // 产出，与文本段按序交错；收口后回到 robot 行的折叠面。
              // #1033：同思考行——骨架接回原语，`chief-msg` 类名保留。
              if (item.kind === 'tool')
                return (
                  <MessageScrollerItem
                    key={item.id ?? i}
                    messageId={item.id}
                    style={SCROLLER_ITEM_STYLE}
                  >
                    <Message className={`chief-msg ${MSG_ROW_CLS}`}>
                      <span className="w-6 shrink-0" aria-hidden="true" />
                      <MessageContent className={MSG_COL_MID_CLS} data-testid="chief-msg-col">
                        <ToolActivityRow
                          name={item.label}
                          {...(item.startedAt !== undefined ? { startedAt: item.startedAt } : {})}
                          {...(item.seconds !== undefined ? { seconds: item.seconds } : {})}
                          {...(item.running !== undefined ? { running: item.running } : {})}
                          {...(item.error !== undefined ? { error: item.error } : {})}
                        />
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              // #739 在飞存在行：回合在飞但首 token 未至的静默窗口——头像槽
              // 复用 robot 行的 agent 身份脸（bound = 绑定 Agent，未 bound =
              // 虚线 chief 字形），右侧 = loading-dev Atom + `处理中...`，与
              // 详情页对话区 streaming 行同一套词汇（transcript.tsx 正典）。
              // 不挂秒数（#471），首 delta 到达即被 typing 行取代。
              if (item.kind === 'streaming')
                return (
                  <MessageScrollerItem key={i} style={SCROLLER_ITEM_STYLE}>
                    <Message className={MSG_ROW_CLS} data-testid="chief-msg">
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
                      <MessageContent className={MSG_COL_LIVE_CLS}>
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
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
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
                // #1009 A1：骨架翻 Message 原语，正文包 Bubble ghost 档
                // （裸文本面——结构走原语、皮肤零：p-0/bg-transparent/
                // rounded-none 由 ghost 档父选择器承载）；定稿行 key/
                // messageId 走源 chief_message id（打字尾行无 id 回落 index）。
                <MessageScrollerItem
                  key={item.id ?? i}
                  messageId={item.id}
                  style={SCROLLER_ITEM_STYLE}
                >
                  <Message
                    className={identity != null ? MSG_ROW_IDENTITY_CLS : MSG_ROW_CLS}
                    data-testid="chief-msg"
                  >
                    {identity ?? (
                      <ChiefFaceDashed width={24} height={24} className={AVATAR_SLOT_CLS} />
                    )}
                    <MessageContent className={MSG_COL_MID_CLS} data-testid="chief-msg-col">
                      <Bubble variant="ghost" className={BUBBLE_WRAP_CLS}>
                        <BubbleContent className={BUBBLE_ROBOT_CLS}>
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
                        </BubbleContent>
                      </Bubble>
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
                          {item.seconds !== '' && <span>{t('完成 {n}', { n: item.seconds })}</span>}
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
                                <span className="flex-none text-(--destructive)">{t('失败')}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              );
            })}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        {/* #991 Q6：jump-to-latest 随原语带入（删除才是定制；原型实审
                过目）——MessageScrollerButton direction=end，render 缺省 =
                仓 Button secondary/icon-sm 档（档位在位）；children 覆写 =
                仓 ArrowDown 字形 + t() sr-only 文案（pristine 面的英文
                字面量不进 i18n 账）。落位/显隐动效 = 原语默认（底缘居中、
                近底自动退场 data-[active=false]）。 */}
        <MessageScrollerButton direction="end">
          <ArrowDown width={16} height={16} />
          <span className="sr-only">{t('滚动到最新')}</span>
        </MessageScrollerButton>
      </MessageScroller>

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
              chief.running === true ? CHIEF_INPUT_PLACEHOLDER_STEERING : CHIEF_INPUT_PLACEHOLDER,
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
    </>
  );
}
