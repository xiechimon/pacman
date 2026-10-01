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
// focused control must not block the chord.

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
