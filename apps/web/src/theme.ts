// Theme mechanism (r2 §1.5): dark is the :root default, light is opted in
// by putting .light on <html>. Persisted under the brand-slot key
// `pacman-theme` (observed original `tds-theme`, r2 §1.5; D3 同形替换
// #109; values: "light" | "dark"), mirrored to data-theme like the official app.
// The only visible control is the 外观 segmented row inside the user-menu
// popover (#122 wired it to applyTheme; the popover open/close trigger
// still waits on the overlay ticket); the parity harness sets the theme
// via storage injection.
// #129: a visit with no stored choice follows the system preference
// (matchMedia prefers-color-scheme); a stored value always wins, and the
// boot-time applyTheme persists the resolved choice.

export const THEME_STORAGE_KEY = 'pacman-theme'; // mirrored in parity/run.mjs THEME_KEY

export type Theme = 'light' | 'dark';

export function readStoredTheme(storage: Storage): Theme {
  const stored = storage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // 无存储 = 跟系统；无 matchMedia 的环境（非浏览器测试）保持 dark 默认。
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

export function applyTheme(theme: Theme, storage: Storage = localStorage): void {
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  root.dataset.theme = theme;
  storage.setItem(THEME_STORAGE_KEY, theme);
}
