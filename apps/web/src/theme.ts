// Theme mechanism (r2 §1.5): dark is the :root default, light is opted in
// by putting .light on <html>. Persisted under the observed key `tds-theme`
// (values: "light" | "dark"), mirrored to data-theme like the official app.
// The only visible control is the 外观 segmented row inside the user-menu
// popover (static render, #56); the parity harness sets the theme via
// storage injection.

export const THEME_STORAGE_KEY = 'tds-theme'; // mirrored in parity/run.mjs THEME_KEY

export type Theme = 'light' | 'dark';

export function readStoredTheme(storage: Storage): Theme {
  return storage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme, storage: Storage = localStorage): void {
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  root.dataset.theme = theme;
  storage.setItem(THEME_STORAGE_KEY, theme);
}
