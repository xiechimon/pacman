import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { applyTheme, readStoredTheme } from './theme.js';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/motion.css';
import './styles/app.css';

applyTheme(readStoredTheme(localStorage));

const container = document.getElementById('root');
if (container == null) {
  throw new Error('#root missing in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
