// New-task dialog (issue #66, r7 04/14; spec 15 #394 改造): 672×439 centered
// modal over the board. Head = project chip + centered 新建任务 + close;
// body = 单字段正文 textarea（无标题输入——保存时 server 落占位标题 = 正文
// 首行截断，执行 agent 接单后经 set_task_meta 回填正式标题，ADR 0002）；
// footer = composer-style toolbar + 保存 / 保存并开始（闸 = 正文非空）。
// #176: the project chip is a selector — click opens an anchored popover
// (family law #67/#127: FloatingShell + ClickCatcher + Esc——#656 起壳归
// Base UI layer 栈, dhead chip popover precedent), rows = the project set (live = useProjects truth;
// fixture = scenario projectNames / canon default), selection backfills the
// chip and rides the submit's projectId（rememberProject 面另落一份
// localStorage 记忆，见下 XMON-87 段）。
// A3-overlays 收编：footer 双钮 = components/ui/Button（ghost / brand，弹窗
// 语义 default 档 32px，r7 实测 30 归一到原语三档）。
//
// M7 #310 附件 wire（r9 §3.1）：
//   - spec 受控：live 创建面父持 state，附件 token 才能注入；fixture/静态
//     div 面父不传 spec/onSpecChange → 内部 useState fallback，零行为差
//   - 附件钮 = 原生文件多选触发器，选中文件 → onAttachment(files) 委托
// #311: spec textarea now owns state + the 提及 button opens the same
// MentionPicker the composer uses. Mention tokens land at the spec
// caret position via insertMentionText — the spec rides along to the
// createTodo body unchanged, and the rendering side (Segments) parses
// them back into chips when the description is shown later.
// #318 未保存闸 (r9 §3.4): 正文非空时,三条关闭路径(X / backdrop /
// Esc)先过「放弃新建任务？未保存的内容将丢失。」确认弹层(继续编辑 / 放弃
// 并关闭);净表单直关不闸。Esc 分层沿 #176 内层优先律(确认层 → 提及
// picker → 项目 popover → dialog;#656 起四层同栈 = Base UI layer 序,
// 最顶先收)。关闭即重置表单(retained-mount 重开 =
// 净面,闸判定不带脏残留)。#394 起 dirty = 正文单字段（标题/标签面移除）。
//
// XMON-95 ⌘↵：保存并开始 除点击外可由 ⌘↵（非 mac = Ctrl+↵）触发，和弦走
// overlays/hotkeys.ts 的 useChordHotkey（可复用注册位，本票是它的第一个面
// 内消费点），按钮上带常亮按键角标。守卫/闸/标识三处细节见各自行注。
// XMON-87 选择记忆：rememberProject 面（board / 侧栏全局面）把选中项目 id 落
// localStorage，刷新后 chip 回上次那行——此前是纯表单 state，刷新即掉回
// rows[0]（用户实测「选 Pacman → 刷新 → 回第一个」）。锚定面不记忆，理由见
// 该 prop 注记。
// XMON-87 续二：Tab 直接换项目（chip 上挂 Tab 悬浮提示 chip，#468 族）——循环
// 而不是开面（「直接切换」要的是按一下就换）；开态门与守卫见
// overlays/hotkeys.ts 的 useProjectCycleHotkey。
// #758 机器选择记忆：机器 chip 接上与 XMON-87 同一套 localStorage 机制（键
// pacman.newTaskMachineId，选即写、选「自动」清、挂载与关闭重开时恢复）。
// 设计裁决（无条件记忆、不加 hover 线索）与两条恢复降级路径（悬空 → 自动、
// 离线 → 如实显示）见记忆位与 machinePin 处注释。

import type { ClipboardEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { FLOATING_POP_ANIM, FloatingShell } from '../components/ui/floating-shell.js';
import { Kbd } from '../components/ui/kbd.js';
import { KbdHint } from '../components/ui/kbd-hint.js';
import { PROJECT_ID, PROJECT_NAME } from '../fixtures/fixtures.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronDown, Grid2x2, Paperclip, X } from '../icons/index.js';
import { ClickCatcher } from '../overlays/dismiss.js';
import { isEditableTarget, useChordHotkey, useProjectCycleHotkey } from '../overlays/hotkeys.js';
import {
  createPastedNameCounter,
  filesFromClipboardData,
  insertAttachmentTokens,
  type PastedNameCounter,
  preparePastedFiles,
} from './attachment-paste.js';
import { type MentionGroups, MentionPicker } from './mention-picker.js';
import { insertMentionText, type MentionToken } from './mention-token.js';
import './overlay.css';

/** Spec textarea template lines, verbatim r2 §5.2 / r7 04 placeholder
 *  block — dict keys so the en fallback carries them too. */
const SPEC_TEMPLATE_LINES = [
  '我想要的结果：',
  '现在的情况：',
  '需要保留或避免：',
  '我会这样确认完成：',
  '我希望收到：',
];

/** #176 选择器行:live = ProjectRecord 最小投影(id/name);fixture =
 *  scenario projectNames。 */
interface ProjectOption {
  id: string;
  name: string;
}

/** #682 机器选择器行：live = MachineRecord 最小投影(id/name/online)；
 * fixture = scenario resources machines（id 缺省退 name）。与项目 chip 同族
 * （anchored popover + listbox），但选择集多一行「自动」（null = 不钉，
 * 任何在线机器可领）。offline 机器可选——钉选语义 = 等它上线（claim 过滤
 * 面保证步只投给该机），与 branch-dialog 的「只列在线」是两个面。 */
export interface MachineOption {
  id: string;
  name: string;
  online?: boolean;
}

/** XMON-87 选择记忆位(localStorage 键;e2e 镜像 newtask-project-persist.spec.ts)。
 *  单租户单机、无账号维度——与 pacman.sidebar-collapsed /
 *  pacman.dirBrowser.lastDir 同律。 */
export const NEW_TASK_PROJECT_STORAGE_KEY = 'pacman.newTaskProjectId';

/** 读记忆位:隐私模式等抛 = 无记忆(dir-browser W13 同律)。 */
function readRememberedProject(storage: Storage): string | null {
  try {
    return storage.getItem(NEW_TASK_PROJECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeRememberedProject(storage: Storage, projectId: string): void {
  try {
    storage.setItem(NEW_TASK_PROJECT_STORAGE_KEY, projectId);
  } catch {
    // 写不进 = 不记住,选择本身不受损(W13 同律)
  }
}

/** #758 机器 chip 选择记忆位(localStorage 键;e2e 镜像
 *  newtask-machine-persist.spec.ts)。设计裁决(票面要求先给结论再动手):
 *  **无条件记忆**——选即写、选「自动」= 清记忆位,不加专门的 hover 线索。
 *  理由:① chip 常显选中机器名(非「自动」),每次开对话框在保存前都看得到
 *  钉了哪台——常显的机器名比 hover 才出现的提示是更强的线索,「钉过一次
 *  之后忘了」的风险已被覆盖;② 「只在非默认时记住」与无条件记在存储面上
 *  功能等价(恢复「自动」与无记忆不可区分),两方案的差别只剩线索本身;
 *  ③ 与项目 chip 同一套机制同一个心智模型,不引入新 i18n 字符串。
 *  不像 rememberProject 那样走 prop 门控:锚定面例外(#404 project 页)来自
 *  「锚恒等于路由项目」的项目语义(#305 律);机器是全局执行选择,没有任何
 *  路由要顶掉它的缺省。 */
export const NEW_TASK_MACHINE_STORAGE_KEY = 'pacman.newTaskMachineId';

/** 读记忆位:隐私模式等抛 = 无记忆(readRememberedProject 同律)。 */
function readRememberedMachine(storage: Storage): string | null {
  try {
    return storage.getItem(NEW_TASK_MACHINE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** 写记忆位:null(选「自动」) = 清。写不进 = 不记住,选择本身不受损(W13 同律)。 */
function writeRememberedMachine(storage: Storage, machineId: string | null): void {
  try {
    if (machineId === null) storage.removeItem(NEW_TASK_MACHINE_STORAGE_KEY);
    else storage.setItem(NEW_TASK_MACHINE_STORAGE_KEY, machineId);
  } catch {
    // 写不进 = 不记住,选择本身不受损(W13 同律)
  }
}

/** fixture 面项目集兜底:scenarios 不带 projectNames 时退 canon 单默认
 *  项目(r3-lifecycle,#176 票面「至少默认项目」)。 */
const DEFAULT_PROJECT: ProjectOption = { id: PROJECT_ID, name: PROJECT_NAME };

/** XMON-95 面级守卫：输入态吞键收窄到本面板之外（⌘J 的 drawer-interior
 *  律平移，hotkeys.ts 注记）。面板打开时 autofocus 落正文 textarea——守卫
 *  若在面板内照吞，和弦永远打不到「保存并开始」。类名出处 = 下方 DialogShell
 *  的 className（.dlg 面板根）。提及 picker 是面板外的兄弟层，其输入框照
 *  吞：在提及面里按 ⌘↵ 不该提交（Enter 在那里是选中语义）。 */
const isEditableOutsideDialog = (target: EventTarget | null): boolean =>
  isEditableTarget(target) &&
  !(target instanceof HTMLElement && target.closest('.new-task-dialog') !== null);

/** XMON-95 界面标识：通用快捷键和弦在这块面板上的字面量。沿用 sidebar
 *  badge 先例（⌘K / C）——不做平台探测、不进 i18n 词典；非 mac 实际绑定
 *  Ctrl+↵ 同族（hotkeys 注册处双平台收）。 */
const START_SHORTCUT_LABEL = '⌘↵';

export interface NewTaskDialogProps {
  /** #73: retained-mount open flag — the exit fade outlives the close. */
  open: boolean;
  onClose: () => void;
  /** spec 15 #394:提交 = 正文 + 选中项目 id（无标题/标签——标题 server 派生
   *  占位、agent 回填；标签固定词表由 agent 归类）。
   *  #311：spec 参数携带 mention token 内容——父级负责透传到
   *  createTodo body。 */
  onSave: (spec: string, projectId?: string, machineId?: string | null) => void;
  /** M5 live 面：保存并开始 = 创建 + POST builds（r2 §4.2 双钮语义）；
   * 缺省 = fixture 行为（同 保存）。#682 机器参数同 保存 面。 */
  onSaveAndStart?: (spec: string, projectId?: string, machineId?: string | null) => void;
  /** M5 live：项目集真值(选择器行数据源);缺省 = fixture canon 单默认
   * 项目(live = projectsQ 投影,fixture = scenario projectNames)。 */
  projects?: ProjectOption[];
  /** #682：机器集真值（选择器行数据源）；缺省 = 空集（chip 只显「自动」，
   * 选择器只有自动一行——单机/未加载的降级面）。 */
  machines?: MachineOption[];
  /** M7 #310 受控 spec：live 创建面父持 state,附件 token 才能注入;fixture
   * 面不传 → 内部 useState fallback。 */
  spec?: string;
  onSpecChange?: (next: string) => void;
  /** M7 #310 附件（#729 契约收窄）：附件钮选件 / 剪贴板粘贴 →
   * onAttachment(files)，父负责 grant + upload，返回成功文件的 token；
   * 注入 spec（行原子、粘贴落 caret 位）由本文件的 runAttachment 统一做。
   * 父组件在 live 创建面下应同时传 spec/onSpecChange 才能接住注入。 */
  onAttachment?: (files: File[]) => string[] | Promise<string[]>;

  /** #311: mention picker groups（5 类别）。父级从 live hooks 或
   *  fixture 派生；缺省 = 空集合（picker 首层 0 计数）。 */
  mentionGroups?: MentionGroups;

  /** XMON-87 选择记忆:true = 选中行跨刷新存活(挂载读一次、选行写回)。
   *  缺省 false = 纯表单 state。锚定面(#404 project 页)走缺省——那面的
   *  未动选择恒等于 rows[0] = 本页路由项目(#305 律),全局记忆会把它顶掉。 */
  rememberProject?: boolean;
}

export function NewTaskDialog({
  open,
  onClose,
  onSave,
  onSaveAndStart,
  projects,
  machines,
  spec: specProp,
  onSpecChange,
  onAttachment,

  mentionGroups,
  rememberProject = false,
}: NewTaskDialogProps) {
  const { t } = useI18n();
  // M7 #310 受控 spec：fallback 模式（fixture 静态 div）内部 useState，
  // 父组件未传 spec/onSpecChange 时走 fallback,行为字节不变。
  const [internalSpec, setInternalSpec] = useState('');
  const specControlled = specProp !== undefined && onSpecChange !== undefined;
  const spec = specControlled ? (specProp as string) : internalSpec;
  const setSpec: React.Dispatch<React.SetStateAction<string>> = specControlled
    ? (next) =>
        (onSpecChange as (s: string) => void)(typeof next === 'function' ? next(spec) : next)
    : setInternalSpec;
  // #311 mention picker
  const [pickerOpen, setPickerOpen] = useState(false);
  // #318 未保存闸确认层开态
  const [discardOpen, setDiscardOpen] = useState(false);
  // #176 选择器 state:popover 开态 + 选中行。null = 未动,展示/提交取
  // 首行;live 空项目集时 selected 退 undefined(chip 走 canon 名)。
  // XMON-87 记忆面:初值 = 上次选中的项目 id。存的值不在行集里(被删/无权限)
  // = find 打空、selected 落回首行——不报错不白屏,记忆位留着不动(行集可能
  // 只是还没加载,按缺省清记忆会误伤真值)。
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(() =>
    rememberProject ? readRememberedProject(localStorage) : null,
  );
  // #682 机器 chip：popover 开态 + 选中行（null = 自动）。#758 接上 XMON-87
  // 同一套记忆机制：初值 = 上次钉的机器（挂载读一次）。存的值可能不在行集
  // 里（机器被删/改名，或查询未决行集还没到）——悬空 id 由下方 machinePin
  // 解析位统一落回「自动」（显示与提交同吃解析值）；记忆位留着不动（项目
  // 记忆位同律：行集可能只是还没加载，按缺省清记忆会误伤真值）。开一个
  // popover 收另一个（head 同层双 chip，两面同开会让 Esc 分层歧义）。
  const [machineOpen, setMachineOpen] = useState(false);
  const [machineId, setMachineId] = useState<string | null>(() =>
    readRememberedMachine(localStorage),
  );
  // #656：popover 的 FloatingShell 把 Portal 挂回 chip wrap（absolute 面板的
  // containing block 原位保真）；wrap 随 dialog 内容先挂，popover 开态翻转时
  // ref 必已就位。机器 popover 同律（#682 的 chip 面随 #656 家族迁壳）。
  const projectWrapRef = useRef<HTMLSpanElement | null>(null);
  const machineWrapRef = useRef<HTMLSpanElement | null>(null);
  // M7 #310 附件：file picker ref + 上传中 disable 纸夹扣
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attaching, setAttaching] = useState(false);
  // #729：粘贴编号 counter（每 draft 递增，CC [Image #N] 精神）+ 在途上传
  // 计数（阻保存/⌘↵，state 异步、ref 同步）+ spec 镜像（上传完成时注入
  // 以最新已提交值为底——render 闭包里的 spec 会吞掉上传期间的打字）+
  // 待恢复 caret 位。与 overlay/composer-wire.ts 的同名机制同构，共享的
  // 行原子插入函数保证两面不漂移（票面失败方式 9）。
  const pastedNameCounterRef = useRef<PastedNameCounter | null>(null);
  if (pastedNameCounterRef.current === null) {
    pastedNameCounterRef.current = createPastedNameCounter();
  }
  const attachInFlightRef = useRef(0);
  const pendingCaretRef = useRef<number | null>(null);
  const specMirrorRef = useRef(spec);
  specMirrorRef.current = spec;
  const rows = projects ?? [DEFAULT_PROJECT];
  const selected = rows.find((row) => row.id === projectId) ?? rows[0];
  const projectName = selected?.name ?? PROJECT_NAME;
  // #682：机器行集 + 选中行（首行恒「自动」）。offline 行照常可选——钉选
  // 语义 = 步只投给该机并等它上线（server claim 过滤面），UI 不替用户挡。
  const machineRows = machines ?? [];
  const machineSelected = machineRows.find((row) => row.id === machineId) ?? null;
  // #758 解析后的钉选:显示、aria 与提交同吃这一个值。悬空记忆(机器被删/
  // 改名/行集未决) → null = 自动,不把指向不存在机器的 pin 带上提交面;
  // 离线机器 → 行照常命中,id 原样保留并如实显示离线 dot(#687 钉选 =
  // 等它上线语义,不静默改派)。
  const machinePin = machineSelected?.id ?? null;
  const machineLabel = machineSelected?.name ?? t('自动');
  // #318: 附件 token 注入 spec 后由 spec 非空承载 dirty,不另计。

  const dirty = spec.trim() !== '';
  // #389 硬化（叠加在 #394 的 effect 归还之上）：用户发起的关闭路径同步
  // 归还——effect 归还在负载下可滞后于紧随的断言读（overlay-focus 批跑
  // 实测 race）。脏表单只开确认层（dialog 不关，焦点不还）。
  const returnFocusToInvoker = () => {
    const el = returnFocusRef.current;
    returnFocusRef.current = null;
    if (el && el !== document.body && document.contains(el)) el.focus();
  };
  const requestClose = () => {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    returnFocusToInvoker();
    onClose();
  };
  // Esc 分层 4 层(内层优先):确认层 → 提及 picker → 项目 popover → dialog 关闸
  // (合并 #311 picker + #318 闸;discardOpen/pickerOpen 各由自己的壳接管 Esc
  // ——ClickCatcher / FloatingShell(#425 B1 起 picker 走 Base UI layer 栈),
  // 本文件只控 dialog 自身的 Esc 关闸。)
  // retained mount:dialog 关闭一并收 popover(重开不得带回开态) + 确认层
  // + picker,并重置表单(重开不得带回开态/脏字——闸判定以净面起步)
  useEffect(() => {
    if (!open) {
      setProjectOpen(false);
      setMachineOpen(false);
      setDiscardOpen(false);
      setPickerOpen(false);
      setSpec('');
      // #758 重开净面 = 记忆面：reset 目标从恒 null 改为记忆值（选即写，
      // 故通常与当前 state 等值；重读兜住「记忆被并发改动」的边角）。
      setMachineId(readRememberedMachine(localStorage));
    }
  }, [open]);
  // retained mount：关闭退场后子树卸载,重开 = 重新挂载。autofocus 挂 ref
  // callback（挂载瞬间触发,绕过壳层的 effect 时序——首开时
  // 对话框 effect 早于子树挂载,effect 里聚焦会打空）。useCallback 稳定
  // 引用 = 输入期重渲染不重复触发（同元素同 ref 不重逢）。
  const specRef = useRef<HTMLTextAreaElement | null>(null);
  const focusSpecRef = useCallback((el: HTMLTextAreaElement | null) => {
    specRef.current = el;
    el?.focus();
  }, []);
  // 焦点归还（#388 族律）：开时记下触发元素,关时归还——正文 textarea 随
  // 退场卸载,不归还会掉回 body（键盘用户丢失上下文;overlay-focus e2e 的
  // Esc 后环断言依赖焦点回到触发钮）。
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      return;
    }
    returnFocusToInvoker();
  }, [open]);
  // #723 真回归修：闸层拥有键盘时焦点显式落闸内。overlay-mount 退役前送焦
  // 走注册表；#656 起壳 = FloatingShell 缺省 initialFocus，sibling root 不
  // 再送焦——焦点停 composer，keep 钮 toBeFocused 落空（hotkeys /
  // dead-buttons 双面钉）。父 effect 后于壳子树 effect 落子，开层提交后钮
  // 必已挂载。关层（继续编辑三路）焦点回 composer，还旧终态；drop 路关整
  // dialog，走 dialog 自身归还，不经此。
  const keepBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (discardOpen) keepBtnRef.current?.focus();
  }, [discardOpen]);
  const closeDiscard = () => {
    setDiscardOpen(false);
    specRef.current?.focus();
  };

  // XMON-87 续二:Tab 直接换项目(chip 上挂 Tab 提示 chip)。循环而不是开面
  // ——「直接切换」要的是按一下就换了,不是先弹列表再选;列表那条路(点 chip)
  // 原样留着。焦点不动:Tab 是打字途中的手势,搬焦点就把打字打断了。
  // 开态门三条:面板开着、至少两行、未保存闸确认层没起来。
  //  - 关着:hook 不注册,Tab 交还浏览器(同 ⌘↵ 的 opened-gate)。
  //  - 单项目:循环是空转,吃下 Tab 只会白挡走位,同样交还浏览器。
  //  - 确认层起来(open 仍为真,它是 dialog 之外的兄弟层 #318):这一层没有
  //    焦点陷阱,焦点仍停在 composer 这个「驾驶位」上。此时若不缺席,Tab 会被
  //    吃下换成项目,键盘用户就再也走不到「继续编辑 / 放弃并关闭」两个钮——
  //    键盘陷阱。README 的「仍能走到每一个控件」正是靠这一条成立。
  const cycleProject = useCallback(() => {
    if (rows.length < 2) return;
    const index = rows.findIndex((row) => row.id === selected?.id);
    const next = rows[(index + 1) % rows.length];
    if (next === undefined) return;
    setProjectId(next.id);
    if (rememberProject) writeRememberedProject(localStorage, next.id);
  }, [rows, selected?.id, rememberProject]);
  useProjectCycleHotkey(open && !discardOpen && rows.length > 1, cycleProject);

  /** 上传委托运行器（#729：选件与粘贴共用）：attaching 计数跟踪（重叠
   *  上传保持保存闸关闭到最后一个落地）、返回 token 行原子注入 spec
   *  （caret=null = 尾追，#310 原形态）、React 提交后恢复 caret——仅当
   *  textarea 仍持有焦点，文件选择器往返不抢焦点。 */
  const runAttachment = (files: File[], caret: number | null, also?: () => void) => {
    if (!onAttachment) {
      also?.();
      return;
    }
    attachInFlightRef.current += 1;
    setAttaching(true);
    void Promise.resolve(onAttachment(files))
      .then((tokens) => {
        if (tokens.length === 0) return;
        const inserted = insertAttachmentTokens(specMirrorRef.current, tokens, caret);
        pendingCaretRef.current = inserted.caret;
        setSpec(inserted.value);
        requestAnimationFrame(() => {
          const ta = specRef.current;
          const next = pendingCaretRef.current;
          pendingCaretRef.current = null;
          if (ta != null && next != null && document.activeElement === ta) {
            ta.setSelectionRange(next, next);
          }
        });
      })
      .catch((err) => {
        // 单文件失败已由父面 toast；委托整体 reject 是 bug——记日志，
        // 不静默吞（#729 失败方式 4）。
        console.error('attachment delegate failed', err);
      })
      .finally(() => {
        attachInFlightRef.current = Math.max(0, attachInFlightRef.current - 1);
        if (attachInFlightRef.current === 0) setAttaching(false);
        also?.();
      });
  };

  // M7 #310 附件选择回调：files → runAttachment（尾追注入）；reset value
  // 允许同文件再选（change 事件不重发同源）
  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    runAttachment(files, null);
  };

  // #729 剪贴板粘贴：文件走同一条 attachFile 链（父面 grant+upload），
  // token 行原子落 caret 位；混合剪贴板文件优先、文本忽略；纯文本粘贴
  // 事件不被触碰（preventDefault 只在见到文件后发生），行为零变化。
  const handleSpecPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onAttachment) return;
    const files = filesFromClipboardData(event.clipboardData);
    if (files.length === 0) return;
    event.preventDefault();
    const counter = pastedNameCounterRef.current as PastedNameCounter;
    // 每 draft 编号：空 spec 且无在途上传时重置回 1；在途守门防快速
    // 连贴撞号（失败方式 6）。
    counter.begin(specMirrorRef.current.trim() === '');
    const caret = event.currentTarget.selectionStart ?? specMirrorRef.current.length;
    runAttachment(preparePastedFiles(files, counter), caret, () => counter.end());
  };

  // spec 15 #394: 提交 = 正文 + 项目 id；#682 加机器 chip 选中（null = 自动）。
  // #729 失败方式 3：附件上传在途时阻提交——spec 不得带着还没上传完的
  // 附件离场（draft 保全，token 落地后提交照常）。
  const save = () => {
    if (attachInFlightRef.current > 0) return;
    onSave(spec, selected?.id, machinePin);
  };

  // XMON-95：保存并开始 = 按钮点击与 ⌘↵ 共用的同一提交位。闸写在闭包里而
  // 非只靠按钮 disabled——键盘路径不经过 disabled 的点击拦截，漏这一句 ⌘↵
  // 会在空正文上落一个空任务。在途上传闸同律进闭包（#729）。
  const saveAndStart = () => {
    if (attachInFlightRef.current > 0) return;
    if (spec.trim() === '') return;
    if (onSaveAndStart) onSaveAndStart(spec, selected?.id, machinePin);
    else save();
  };
  // enabled = open ∩ ¬discardOpen（useChordHotkey 的 opened-gate）。两条都
  // 缺不得：
  //  - open：面板关着时监听器不在 window 上，否则关掉的对话框仍会吃全站 ⌘↵。
  //  - ¬discardOpen：未保存闸确认层是 dialog **之外**的兄弟层（#318），它起来
  //    时 open 仍是 true，闸只认 open 的话 ⌘↵ 会在「要不要放弃？」这一问之下
  //    把任务**保存并开始**（真起一次 agent 跑）——用户按下时以为自己在回答
  //    那一问。确认层的两个按钮都不是可编辑目标，守卫也拦不住，只能由 enabled
  //    这一层缺席。
  useChordHotkey('enter', isEditableOutsideDialog, saveAndStart, open && !discardOpen);

  // #318 放弃并关闭:清表单 + 关 dialog(父收 open,重置 effect 兜底同律)
  const discardAndClose = () => {
    setDiscardOpen(false);
    setSpec('');
    onClose();
  };

  // Mention insert: route through insertMentionText so the picker
  // and the inline @ listbox share the spacing + caret rules (#728:
  // trailing space included). Multi-select inserts compose in ONE
  // functional update at the evolving caret — a per-token loop would
  // read the same stale `spec` closure per call and keep only the last
  // token (same fix as the composer wire's insertTokens).
  const insertTokens = (tokens: MentionToken[]) => {
    if (tokens.length === 0) return;
    const ta = specRef.current;
    if (ta == null) {
      setSpec((current) => {
        let value = current;
        for (const token of tokens) value = insertMentionText(value, token, null).value;
        return value;
      });
      return;
    }
    const start = ta.selectionStart ?? spec.length;
    const pending = { caret: start };
    setSpec((current) => {
      let value = current;
      let at = start;
      for (const token of tokens) {
        const result = insertMentionText(value, token, at);
        value = result.value;
        pending.caret = result.caret;
        at = result.caret;
      }
      return value;
    });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pending.caret, pending.caret);
    });
  };

  const groups = mentionGroups ?? {
    todo: [],
    skill: [],
    agent: [],
    project: [],
    machine: [],
  };

  return (
    <>
      <DialogShell
        bare
        open={open}
        onClose={requestClose}
        // 外点内层优先（旧 backdrop 上的三分支逻辑）：项目浮层 / 提及 picker
        // 开着先关内层；discard 层由它自己的底座接管；剩余走未保存闸。
        onBackdropClick={() => {
          if (projectOpen) {
            setProjectOpen(false);
            return;
          }
          if (machineOpen) {
            setMachineOpen(false);
            return;
          }
          if (pickerOpen) {
            setPickerOpen(false);
            return;
          }
          requestClose();
        }}
        // #318/#656 分层 Esc：五个内层（picker / 项目 popover / 机器 popover /
        // discard 闸）全部走 FloatingShell（Base UI layer 栈，escapeKey
        // isTopmost 自己收），onEscapeWhileNested 代收闸退役——壳只控 dialog
        // 自身的 Esc 关闸。#682 机器 popover 是同族 chip 面（双开由开面互斥
        // 先行收掉，见两 chip 的 onClick），随 #656 家族一并迁壳。
        // #688 阶梯 --z-panel-low：低档面板（--z-panel-low < ClickCatcher
        // --z-catcher < 确认层 --z-confirm）——缺省的 --z-dialog 会压住本
        // 文件的 discard 确认层，故吃低档；低档仍恒压常驻侧板（--z-docked），
        // 抽屉开着时本面排上方（#688 裁决，e2e/z-ladder.spec 钉扎）。
        zIndex="var(--z-panel-low)"
        className="new-task-dialog"
        width={672}
        height={439}
      >
        <div className="new-task-head">
          {/* #682 第三轮（用户三审）：标题行回归抓拍形态——项目 chip + 居中
              标题 + 关闭，机器选择搬去底栏选项区（执行选择与「保存并开始」
              同族）。项目名 max-width 截断（长名不压居中标题）。 */}
          <span className="new-task-project-wrap" ref={projectWrapRef}>
            <button
              type="button"
              className="new-task-project"
              aria-haspopup="listbox"
              aria-expanded={projectOpen && rows.length > 0}
              onClick={() => {
                setMachineOpen(false);
                setProjectOpen((value) => !value);
              }}
            >
              <span className="new-task-project-avatar">{projectName.charAt(0).toLowerCase()}</span>
              <span className="new-task-project-name">{projectName}</span>
              <ChevronDown width={12} height={12} />
              {/* XMON-87 续二:Tab 提示 chip(#468 悬浮 chip 族,静息隐藏,
                  hover/focus-visible chip 时浮出);label 字面量沿 ⌘K/⌘J
                  先例,不做平台探测。 */}
              <KbdHint label="Tab" placement="right" />
            </button>
            {/* #176:anchored popover 家族律(#67/#127)——#656 起壳 =
                FloatingShell(Esc 归 Base UI 嵌套 layer 栈)+ ClickCatcher;
                Portal 挂回 chip wrap,absolute 面板几何原位保真。空集不开面
                (live 无项目时提交走建默认项目路径)。选中回填 chip,提交携带
                projectId。#666 律:chip 是 toggle 面——焦点留触发位、原生
                outsidePress 关闭(外点归 catcher)。 */}
            <FloatingShell
              open={projectOpen && rows.length > 0}
              onClose={() => setProjectOpen(false)}
              container={projectWrapRef.current}
              className="anchored-pop-shell"
              initialFocus={false}
              disablePointerDismissal
            >
              <ClickCatcher onClose={() => setProjectOpen(false)} />
              <div
                className={`new-task-project-menu ${FLOATING_POP_ANIM}`}
                role="listbox"
                aria-label={t('项目')}
              >
                {rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="new-task-project-row"
                    role="option"
                    aria-selected={row.id === selected?.id}
                    onClick={() => {
                      setProjectId(row.id);
                      if (rememberProject) writeRememberedProject(localStorage, row.id);
                      setProjectOpen(false);
                    }}
                  >
                    <span className="new-task-project-row-avatar">
                      {row.name.charAt(0).toLowerCase()}
                    </span>
                    <span className="new-task-project-row-name">{row.name}</span>
                    {row.id === selected?.id && (
                      <span className="new-task-project-check">
                        <Check width={14} height={14} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </FloatingShell>
          </span>
          <div className="new-task-title-label">{t('新建任务')}</div>
          {/* A4-deep 收编：icon 变体皮肤；28×28 + margin-left:auto 几何
              per-face 留 overlay.css。#318 未保存闸:dialog 关闭走
              requestClose(dirty 时先弹确认层)。 */}
          <Button
            variant="ghost"
            size="icon"
            className="new-task-close"
            aria-label={t('关闭')}
            onClick={requestClose}
          >
            <X />
          </Button>
        </div>
        <div className="new-task-body">
          {/* spec 15 #394：单字段正文——标题输入位移除,占位提示 = 五行模板族
              （首行即任务一句话,占位标题派生取它）。 */}
          <textarea
            ref={focusSpecRef}
            className="new-task-spec"
            placeholder={SPEC_TEMPLATE_LINES.map((line) => t(line)).join('\n')}
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            // #729: clipboard images/files ride the #310 attachFile chain;
            // a text-only paste never reaches the handler's preventDefault.
            onPaste={handleSpecPaste}
          />
          {/* M7 #310 附件：原生文件多选触发器；选中文件 → onAttachment(files)
              委托父处理 grant+upload+setSpec 拼 token；accept 与 server
              ALLOWED_MIME_* 镜像（OS 文件选择器仍可越界,最终 server 强拒兜底） */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={onPickFiles}
            accept="text/*,image/*,application/json,application/pdf,application/xml"
          />
        </div>
        <div className="new-task-footer">
          <div className="new-task-actions">
            {/* A4-deep 收编：icon 变体皮肤；30×30 几何走 .new-task-tools
                button 元素选择器（原样命中） */}
            <div className="new-task-tools">
              {/* #304 C5 裁决:语音输入功能不做(local-first 无语音面)——
                  语音钮移除不渲染,不留死钮;添加附件/提及走 A4 Button 原语。 */}
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('添加附件')}
                disabled={attaching || !onAttachment}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('提及')}
                onClick={() => setPickerOpen((value) => !value)}
              >
                <Grid2x2 />
              </Button>
            </div>
            {/* #682 第三轮（用户三审）：机器选择住底栏选项区——执行选择与
                「保存并开始」同层（语义），与工具簇 12px 组间（工具簇内 6px，
                2× 律）。popover 向上开（footer 在底，向下开会出对话框边界）。
                类名独立 new-task-machine* 家族：e2e 的 `.new-task-project*`
                选择器钉单元素（strict mode），双 chip 共类名会打红整组。 */}
            <span className="new-task-machine-wrap" ref={machineWrapRef}>
              <button
                type="button"
                className="new-task-machine"
                aria-haspopup="listbox"
                aria-expanded={machineOpen && machineRows.length > 0}
                data-testid="new-task-machine-chip"
                onClick={() => {
                  setProjectOpen(false);
                  setMachineOpen((value) => !value);
                }}
              >
                <span
                  className="new-task-machine-dot"
                  data-on={machineSelected?.online ?? true}
                  aria-hidden="true"
                />
                <span className="new-task-machine-name">{machineLabel}</span>
                <ChevronDown width={12} height={12} />
              </button>
              {/* #656：壳 = FloatingShell，与 head 的项目 popover 同族同律
                  （#666 toggle 面：initialFocus=false 焦点留触发位 + 外点归
                  ClickCatcher，原生 outsidePress 只接得住键盘合成 click，与
                  toggle onClick 双写会把面「关不掉」）。Portal 挂回本 wrap，
                  bottom:calc(100%+4px) 的向上开几何原位保真。 */}
              <FloatingShell
                open={machineOpen}
                onClose={() => setMachineOpen(false)}
                container={machineWrapRef.current}
                className="anchored-pop-shell"
                initialFocus={false}
                disablePointerDismissal
              >
                <ClickCatcher onClose={() => setMachineOpen(false)} />
                <div
                  className={`new-task-project-menu new-task-machine-menu ${FLOATING_POP_ANIM}`}
                  role="listbox"
                  aria-label={t('机器')}
                >
                  <button
                    type="button"
                    className="new-task-project-row"
                    role="option"
                    aria-selected={machinePin === null}
                    onClick={() => {
                      setMachineId(null);
                      // #758 选「自动」= 清记忆位（写时机与项目 chip 同：选即写）
                      writeRememberedMachine(localStorage, null);
                      setMachineOpen(false);
                    }}
                  >
                    <span className="new-task-machine-dot" data-on={true} aria-hidden="true" />
                    <span className="new-task-project-row-name">{t('自动')}</span>
                    {machinePin === null && (
                      <span className="new-task-project-check">
                        <Check width={14} height={14} />
                      </span>
                    )}
                  </button>
                  {machineRows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className="new-task-project-row"
                      role="option"
                      aria-selected={row.id === machinePin}
                      onClick={() => {
                        setMachineId(row.id);
                        // #758 选即写（项目 chip 同时机）
                        writeRememberedMachine(localStorage, row.id);
                        setMachineOpen(false);
                      }}
                    >
                      <span
                        className="new-task-machine-dot"
                        data-on={row.online ?? true}
                        aria-hidden="true"
                      />
                      <span className="new-task-project-row-name">{row.name}</span>
                      {row.id === machinePin && (
                        <span className="new-task-project-check">
                          <Check width={14} height={14} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </FloatingShell>
            </span>
            <div className="new-task-buttons">
              {/* e2e 别名叠加：integration/test/m5-web-e2e.test.ts 钉
                  .new-task-start（overlays lane 误删致 CI 红，此处恢复；
                  类名与规则无关，纯选择器锚点） */}
              <Button
                variant="ghost"
                size="default"
                className="new-task-save"
                disabled={spec.trim() === ''}
                onClick={save}
              >
                {t('保存')}
              </Button>
              <Button
                variant="brand"
                size="default"
                className="new-task-start"
                disabled={spec.trim() === ''}
                onClick={saveAndStart}
              >
                {t('保存并开始')}
                {/* XMON-95 界面标识：常亮按键角标（kbd-hint 的 hover chip 是
                    另一面，这里要「看得到」，故静息可见）。落在 kbd.tsx 原语
                    上（COMPONENTS.md「文档正文里的按键角标用 kbd.tsx」），只把
                    registry 的尺寸/配色档逐项改写到本面：本钮是 brand 档——实底 indigo
                    + 白字，故边界/墨取白色系而非 border-border/muted-foreground。
                    aria-hidden：角标是视觉提示，按钮的可及名仍是文字本身。 */}
                <Kbd
                  aria-hidden="true"
                  className="ml-1.5 h-auto min-w-0 rounded-[3px] border border-white/35 bg-transparent px-[3px] py-px text-[11px] leading-4 font-normal text-white/90"
                >
                  {START_SHORTCUT_LABEL}
                </Kbd>
              </Button>
            </div>
          </div>
        </div>
      </DialogShell>
      {/* #318 未保存闸确认层(r9 §3.4 copy 逐字):独立层不入 dialog 面板
          ——面板 transform 会吞 fixed 定位(#176 注记同坑);ClickCatcher
          z29 压 dialog z21,外点 = 只收确认层(继续编辑语义),面板 z31 居顶。
          #656:壳 = FloatingShell(sibling root,MentionPicker 先例);fade 沿
          旧淡入配方的 200ms(--dur-overlay),桥走 slow 变体撑满退场窗。
          initialFocus 走缺省(焦点入层)而非 false:sibling root 的 Esc 路由
          依赖焦点在本层内——实测 initialFocus=false 时(焦点留在 dialog)
          Esc 全被 modal dialog 吃掉(→requestClose→重开本层,确认层关不掉);
          MentionPicker 同款缺省。#247 Tab 可达性不受损(焦点入层后 Tab 即达
          两个动作钮),Tab 循环/⌘↵ 的 discardOpen 缺席门原样。外点归
          catcher,故原生 outsidePress 关闭(#666 律的 catcher 半边)。 */}
      <FloatingShell
        open={discardOpen}
        onClose={closeDiscard}
        className="anchored-pop-shell anchored-pop-shell--slow"
        disablePointerDismissal
      >
        <ClickCatcher onClose={closeDiscard} />
        <div
          className="new-task-discard duration-200 group-data-closed/fshell:fill-mode-forwards group-data-open/fshell:animate-in group-data-open/fshell:fade-in-0 group-data-closed/fshell:animate-out group-data-closed/fshell:fade-out-0"
          role="alertdialog"
          aria-modal="true"
          aria-label={t('放弃新建任务？未保存的内容将丢失。')}
        >
          <div className="new-task-discard-title">{t('放弃新建任务？未保存的内容将丢失。')}</div>
          <div className="new-task-discard-actions">
            <Button
              variant="ghost"
              size="default"
              className="new-task-discard-keep h-auto rounded-none justify-start gap-0 font-normal active:not-aria-[haspopup]:translate-y-0 hover:bg-transparent hover:text-(--text-dim) [&_svg:not([class*='size-'])]:size-auto"
              ref={keepBtnRef}
              onClick={closeDiscard}
            >
              {t('继续编辑')}
            </Button>
            <Button
              variant="destructive"
              size="default"
              className="new-task-discard-drop"
              onClick={discardAndClose}
            >
              {t('放弃并关闭')}
            </Button>
          </div>
        </div>
      </FloatingShell>
      {/* #311 mention picker(sibling layer)。Esc/backdrop 顺序见上分层注记。 */}
      <MentionPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        groups={groups}
        onInsert={(tokens) => {
          insertTokens(tokens);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
