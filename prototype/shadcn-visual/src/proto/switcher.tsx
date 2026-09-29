// PROTOTYPE (#407): 浮动切换条 —— 主题 A/B 循环，←/→ 键同效，URL ?theme= 可分享。
import { useCallback, useEffect } from "react";

const THEMES = [
  { key: "a", name: "A（pacman token 灌 shadcn）" },
  { key: "b", name: "B（shadcn 默认美学）" },
];

export function ThemeSwitcher({ current }: { current: string }) {
  if (new URLSearchParams(window.location.search).get("chrome") === "off") return null;
  const cycle = useCallback(
    (dir: 1 | -1) => {
      const i = THEMES.findIndex((t) => t.key === current);
      const next = THEMES[(i + dir + THEMES.length) % THEMES.length];
      const url = new URL(window.location.href);
      url.searchParams.set("theme", next.key);
      window.location.href = url.toString();
    },
    [current],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle]);

  const label = THEMES.find((t) => t.key === current)?.name ?? current;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/20 bg-black/85 px-4 py-2 font-mono text-xs text-white shadow-2xl backdrop-blur">
      <button onClick={() => cycle(-1)} className="px-1 text-base hover:opacity-70">←</button>
      <span>{label}</span>
      <button onClick={() => cycle(1)} className="px-1 text-base hover:opacity-70">→</button>
    </div>
  );
}
