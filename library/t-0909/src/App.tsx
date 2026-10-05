// PROTOTYPE app shell (#909): docked sidebar + one representative face at a
// time, all under the active variant theme. The overlay/search faces keep the
// board mounted behind (the real product's overlay family opens over it).

import { useCallback, useEffect, useState } from 'react';
import { BoardFace } from './surfaces/board-face.js';
import { DetailFace } from './surfaces/detail-face.js';
import { NewTaskOverlayFace } from './surfaces/newtask-face.js';
import { ResourcesFace } from './surfaces/resources-face.js';
import { SearchFace } from './surfaces/search-face.js';
import { SidebarFace } from './surfaces/sidebar-face.js';
import { PrototypeSwitcher, cycleVariant } from './switcher.js';
import { readState, writeState, type ProtoState } from './state.js';

export function App() {
  const [state, setState] = useState<ProtoState>(readState);

  useEffect(() => {
    writeState(state);
  }, [state]);

  const patch = useCallback((p: Partial<ProtoState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  // keyboard ← → cycles variants (UI.md contract); never intercept while an
  // editable element has focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') setState((s) => ({ ...s, variant: cycleVariant(s.variant, -1) }));
      if (e.key === 'ArrowRight') setState((s) => ({ ...s, variant: cycleVariant(s.variant, 1) }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full overflow-hidden bg-background text-foreground">
      <SidebarFace />
      <main className="min-w-0 flex-1 overflow-hidden">
        {state.face === 'board' && <BoardFace worst={state.data === 'worst'} />}
        {state.face === 'detail' && <DetailFace />}
        {state.face === 'resources' && <ResourcesFace worst={state.data === 'worst'} />}
        {state.face === 'overlay' && <NewTaskOverlayFace worst={state.data === 'worst'} />}
        {state.face === 'search' && <SearchFace worst={state.data === 'worst'} />}
      </main>
      <PrototypeSwitcher state={state} patch={patch} />
    </div>
  );
}
