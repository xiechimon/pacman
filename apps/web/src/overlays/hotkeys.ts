// Global hotkey wiring (issues #389, #442, #468): C opens the new-task
// dialog from any route (open-only, matching the row click semantics);
// ⌘J (Ctrl+J off macOS) TOGGLES the chief drawer — the second press closes
// what the first opened (#468), while the FAB click stays open-only. Each
// consumer hook registers one window keydown listener (the ⌘K
// useSearchState precedent). The chord path mirrors the ⌘K registration
// form: cmd and ctrl both accepted, main key compared case-insensitively.
// Guards keep native semantics intact: editable targets (input/textarea/
// select/contenteditable) swallow both keys — typing must never wake a
// surface. ⌘J's guard narrows that law to OUTSIDE the chief drawer: the
// open lands focus in the composer (a textarea), and a guard that swallows
// the chord inside the drawer it owns would make the toggle unable to
// close itself. Buttons and links still carry no native ⌘J semantics, so a
// focused control must not block the chord. XMON-87 adds the family's only
// binding that consumes a native browser key: Tab switches the new-task
// dialog's project from its two driving seats (the chip and the composer),
// with Shift+Tab left native as the keyboard way out of that seat.

import { useEffect } from 'react';

/** 输入态：两键共用的守卫（票面「input/textarea/contenteditable 不触发」；
 *  select 同律——原生 typeahead 吃字符键，不可劫持）。 */
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest(EDITABLE) !== null;

/** ⌘J 专属守卫（#468 toggle 律）：输入态吞键收窄到 drawer 之外。drawer
 *  打开时 autofocus 落 composer（textarea），若守卫在 drawer 内部照吞，
 *  和弦就关不上自己打开的面。drawer 外的输入态（⌘K 搜索框等）维持原律
 *  ——hotkeys.spec 钉住「搜索框里 ⌘J 不得开 drawer」。类名出处 =
 *  chief-drawer.tsx 的 aside 根。 */
const isEditableOutsideChiefDrawer = (target: EventTarget | null): boolean =>
  isEditableTarget(target) &&
  !(target instanceof HTMLElement && target.closest('.chief-drawer') !== null);

/** Tab 换项目（XMON-87 续二）的「驾驶位」：项目 chip 与 composer textarea。
 *  Tab 只在这两处被吃下换项目——其余控件（提及 / 保存 / 关闭）保留原生走位，
 *  纯键盘用户照旧能靠 Tab / Shift+Tab 走到每一个控件。
 *  类名出处 = new-task-dialog.tsx 的 chip 与 textarea。 */
const TAB_CYCLE_SEATS = ['.new-task-project', '.new-task-spec'];

const isTabCycleSeat = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  TAB_CYCLE_SEATS.some((selector) => target.closest(selector) !== null);

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
 *  定（⌘J = toggle）；OS 按住连发（event.repeat）必须忽略——toggle 会在
 *  连发下开↔关振荡。 */
function useChordHotkey(
  key: string,
  guard: (target: EventTarget | null) => boolean,
  onFire: () => void,
) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.repeat) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== key) return;
      if (guard(event.target)) return;
      // Consume the default wherever the press reaches the page, so a
      // browser action bound to the same chord (Firefox mac's downloads
      // library) cannot fire alongside the drawer.
      event.preventDefault();
      onFire();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, guard, onFire]);
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

/** Tab → 新建任务 dialog 换项目（XMON-87 续二；chip 上挂 Tab 提示 chip）。
 *  与 C / ⌘J 两条裸键同族，但它是唯一一条吃掉浏览器原生语义的绑定：Tab
 *  换项目之后就不再走位了。三处收窄，缺一不可——
 *  - 只在驾驶位（chip / composer textarea）吃：别处的 Tab 原样走位；
 *  - 带修饰键的不吃：⌘Tab（切窗）、Ctrl+Tab（切标签页）、Alt+Tab 是系统的；
 *  - Shift+Tab 留给原生反向走位：Tab 既然被「换项目」占用，它就是纯键盘用户
 *    离开驾驶位的出口，一并不吃等于把这面变成鼠标专属。
 *  active = 面的开态门（dialog 关着、或项目不足两行时不注册——单项目循环是
 *  空转，吃下 Tab 只会白挡走位）。 */
export function useProjectCycleHotkey(active: boolean, onCycle: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      if (event.defaultPrevented || event.isComposing) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (!isTabCycleSeat(event.target)) return;
      event.preventDefault();
      onCycle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onCycle]);
}
