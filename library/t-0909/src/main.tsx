// PROTOTYPE entry (#909). URL params drive everything so every state is
// shareable and reload-stable: ?variant=a|b|c &face=board|detail|overlay|search|resources &mode=dark|light
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles/base.css';

createRoot(document.getElementById('root')!).render(<App />);
