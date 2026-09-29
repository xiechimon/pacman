// Global hotkey wiring (issues #389, #442): N opens the new-task dialog from
// any route, ⌘J (Ctrl+J off macOS) wakes the chief drawer. Both are
// open-only (never toggle), matching the FAB/row click semantics, and each
// consumer hook registers one window keydown listener (the ⌘K
// useSearchState precedent). The chord path mirrors the ⌘K registration
// form: cmd and ctrl both accepted, main key compared case-insensitively.
// Guards keep native semantics intact: editable targets (input/textarea/
// select/contenteditable) swallow both keys — typing must never wake a
// surface. That is ⌘J's entire guard: buttons and links carry no native ⌘J
// semantics, so a focused control must not block the chord.

import { useEffect } from 'react';

/** 输入态：两键共用的守卫（票面「input/textarea/contenteditable 不触发」；
 *  select 同律——原生 typeahead 吃字符键，不可劫持）。 */
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest(EDITABLE) !== null;

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
 *  参照——双平台收、主键大小写不敏感，key 传小写）。 */
function useChordHotkey(
  key: string,
  guard: (target: EventTarget | null) => boolean,
  onOpen: () => void,
) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== key) return;
      if (guard(event.target)) return;
      // Consume the default wherever the press reaches the page, so a
      // browser action bound to the same chord (Firefox mac's downloads
      // library) cannot fire alongside the drawer.
      event.preventDefault();
      onOpen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, guard, onOpen]);
}

/** N → 新建任务 dialog（AppSidebar 全局面；行点击与热键共用一个 opener）。 */
export function useNewTaskHotkey(onOpen: () => void): void {
  useHotkey('n', isEditableTarget, onOpen);
}

/** ⌘J / Ctrl+J → 总管抽屉（useChiefSurface 全局面；与 FAB 点击同一 wake
 *  动作）。守卫仅输入态：按钮/链接不承担 ⌘J 的原生激活语义，聚焦控件不得
 *  挡住和弦。 */
export function useChiefWakeHotkey(onOpen: () => void): void {
  useChordHotkey('j', isEditableTarget, onOpen);
}
