// PROTOTYPE stub of apps/web/src/overlays/dismiss.tsx — identical component,
// minus the per-face overlays.css import (the catcher rule lives in base.css).

export function ClickCatcher({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="overlay-click-catcher"
      tabIndex={-1}
      aria-hidden="true"
      onClick={onClose}
    />
  );
}
