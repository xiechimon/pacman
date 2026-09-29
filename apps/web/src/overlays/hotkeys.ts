// Global hotkey wiring (issue #389): N opens the new-task dialog from any
// route, Space wakes the chief drawer. Both are open-only (never toggle),
// matching the FAB/row click semantics, and each consumer hook registers one
// window keydown listener (the ⌘K useSearchState precedent). Guards keep
// native semantics intact: editable targets (input/textarea/select/
// contenteditable) swallow both keys — typing must never wake a surface;
// interactive targets (buttons, links, menu/option roles) additionally keep
// Space for native activation (keydown default drives the keyup click);
// modifier chords (⌘N, Ctrl+Space IME switch) always pass through.

import { useEffect } from 'react';

/** 输入态：两键共用的守卫（票面「input/textarea/contenteditable 不触发」；
 *  select 同律——原生 typeahead 吃字符键，不可劫持）。 */
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** 交互态：Space 的守卫 —— 编辑态之外，原生 Space 激活语义的控件族。 */
const INTERACTIVE = [
  EDITABLE,
  'button',
  'a[href]',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
].join(', ');

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest(EDITABLE) !== null;

const isInteractiveTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest(INTERACTIVE) !== null;

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
      // preventDefault only when we fire — Space would otherwise scroll the
      // page; guarded targets keep their native default untouched.
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

/** Space → 总管抽屉（useChiefSurface 全局面；与 FAB 点击同一 wake 动作）。 */
export function useChiefWakeHotkey(onOpen: () => void): void {
  useHotkey(' ', isInteractiveTarget, onOpen);
}
