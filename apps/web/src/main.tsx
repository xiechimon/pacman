import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { applyLocaleLang, readStoredLocale } from './i18n/locale.js';
import { applyTheme, readStoredTheme } from './theme.js';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';

applyTheme(readStoredTheme(localStorage));
// <html lang> before first paint, exactly like the theme (issue #74)
applyLocaleLang(readStoredLocale(localStorage));

const container = document.getElementById('root');
if (container == null) {
  throw new Error('#root missing in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
