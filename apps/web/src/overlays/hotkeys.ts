// Global hotkey wiring (issues #389, #442, #468, XMON-95): C opens the
// new-task dialog from any route (open-only, matching the row click
// semantics); ⌘J (Ctrl+J off macOS) TOGGLES the chief drawer — the second
// press closes what the first opened (#468), while the FAB click stays
// open-only; ⌘↵ (Ctrl+↵ off macOS) fires the new-task dialog's 保存并开始
// (XMON-95). Each consumer hook registers one window keydown listener (the
// ⌘K useSearchState precedent). The chord path mirrors the ⌘K registration
// form: cmd and ctrl both accepted, main key compared case-insensitively.
// Guards keep native semantics intact: editable targets (input/textarea/
// select/contenteditable) swallow both keys — typing must never wake a
// surface. ⌘J's guard narrows that law to OUTSIDE the chief drawer: the
// open lands focus in the composer (a textarea), and a guard that swallows
// the chord inside the drawer it owns would make the toggle unable to
// close itself. Buttons and links still carry no native ⌘J semantics, so a
// focused control must not block the chord.
//
// Two registration shapes, one chord implementation (XMON-95): the global
// keys are always live, while a *surface-scoped* chord (⌘↵ owns an open
// dialog) passes its surface's open flag as `enabled` — a listener left on
// the window while its surface is shut would fire into a form nobody can
// see. Both ride useChordHotkey; the guard is the per-surface half, and
// isEditableTarget is exported so a consuming face can narrow it to its own
// interior rather than re-deriving the editable selector.

import { useEffect, useRef } from 'react';

/** 输入态：两键共用的守卫（票面「input/textarea/contenteditable 不触发」；
 *  select 同律——原生 typeahead 吃字符键，不可劫持）。导出给面级守卫复用
 *  ——消费点按「本面自己的可编辑内部」收窄这条律（XMON-95）。 */
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

export const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest(EDITABLE) !== null;

/** ⌘J 专属守卫（#468 toggle 律）：输入态吞键收窄到 drawer 之外。drawer
 *  打开时 autofocus 落 composer（textarea），若守卫在 drawer 内部照吞，
 *  和弦就关不上自己打开的面。drawer 外的输入态（⌘K 搜索框等）维持原律
 *  ——hotkeys.spec 钉住「搜索框里 ⌘J 不得开 drawer」。类名出处 =
 *  chief-drawer.tsx 的 aside 根。 */
const isEditableOutsideChiefDrawer = (target: EventTarget | null): boolean =>
  isEditableTarget(target) &&
  !(target instanceof HTMLElement && target.closest('.chief-drawer') !== null);

function useHotkey(
  key: string,
  guard: (target: EventTarget | null) => boolean,
  onOpen: () => void,
) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.key !== key) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (guard(event.target)) return;
      // preventDefault only when we fire — guarded targets keep their native
      // default untouched.
      event.preventDefault();
      onOpen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, guard, onOpen]);
}

/** useHotkey 的修饰键同族通路：cmd/ctrl + 主键触发（⌘K 搜索注册处的形态
 *  参照——双平台收、主键大小写不敏感，key 传小写）。onFire 语义由消费点
 *  定（⌘J = toggle，⌘↵ = 提交）。OS 按住连发（event.repeat）必须忽略
 *  ——toggle 会在连发下开↔关振荡，提交会在连发下落一串任务。
 *
 *  导出即复用面（XMON-95）：任何面要挂一条修饰键和弦，传 key + 本面的
 *  guard + onFire 即可，不必重写注册/守卫/preventDefault 三段。**面内和
 *  弦**（只在某个打开着的面上生效）把该面的 open 标志传进 enabled——面关
 *  着时监听器根本不在 window 上（opened-gate；缺省的常驻语义留给全局热
 *  键，如 C/⌘K/⌘J）。enabled 形参沿用 useEscClose 的 (handler, enabled)
 *  惯用位。 */
export function useChordHotkey(
  key: string,
  guard: (target: EventTarget | null) => boolean,
  onFire: () => void,
  enabled = true,
) {
  // #466 律（useEscClose 同法）：接线按 (key, enabled) 周期注册一次，永不
  // 按渲染注册——最新 guard/onFire 走 ref。被动 effect 的清理与重挂之间隔
  // 着一整个调度周期，按渲染重挂会在这段缝里丢掉按键；XMON-95 的消费点每
  // 敲一个字就重渲染一次，这个缝是必然而非偶发。
  const guardRef = useRef(guard);
  const onFireRef = useRef(onFire);
  useEffect(() => {
    guardRef.current = guard;
    onFireRef.current = onFire;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.repeat) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== key) return;
      if (guardRef.current(event.target)) return;
      // Consume the default wherever the press reaches the page, so a
      // browser action bound to the same chord (Firefox mac's downloads
      // library) cannot fire alongside the drawer.
      event.preventDefault();
      onFireRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, enabled]);
}

/** C → 新建任务 dialog（AppSidebar 全局面；行点击与热键共用一个 opener）。
 *  字符键而非和弦：与 ⌘K 搜索、⌘J 总管三键同在守卫族下——输入态吞键，
 *  其余场合裸按即开。 */
export function useNewTaskHotkey(onOpen: () => void): void {
  useHotkey('c', isEditableTarget, onOpen);
}

/** ⌘J / Ctrl+J → 总管抽屉 toggle（useChiefSurface 全局面；#468 起可开
 *  可关，FAB 点击维持 open-only）。守卫 = drawer 外输入态；按钮/链接不承担
 *  ⌘J 的原生激活语义，聚焦控件不得挡住和弦。 */
export function useChiefToggleHotkey(onToggle: () => void): void {
  useChordHotkey('j', isEditableOutsideChiefDrawer, onToggle);
}
