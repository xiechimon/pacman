import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { applyLocaleLang, readStoredLocale } from './i18n/locale.js';
import { applyTheme, readStoredTheme } from './theme.js';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/motion.css';
import './styles/app.css';
// PROTOTYPE #988（throwaway 分支 ui/988-palette-reselect）：色板候选 overlay
// （html[data-variant] 驱动，未挂属性时全惰性）+ 圆角基切换。胜者落 main 时
// 这四行与 styles/proto-988/ 一并删除，定版值 1:1 翻进 shadcn.css。
import './styles/proto-988/d.css';
import './styles/proto-988/e.css';
import './styles/proto-988/f.css';
import './styles/proto-988/proto.css';

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
