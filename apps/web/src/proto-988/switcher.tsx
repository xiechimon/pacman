// PROTOTYPE #988 — 浮动色板切换条（throwaway 分支 ui/988-palette-reselect；
// 胜者落 main 时整目录删除）。两轴：
//   ?variant=now|d|e|f — 色板候选。now = 现行纸兰（历史参考基线，不加
//     overlay）；d/e/f 驱动 styles/proto-988/<x>.css 的 :root[data-variant]
//     overlay（gen-palettes.mjs 生成，对比度实测见 proto-988/contrast-proto.md）。
//   ?radius=official|current — 圆角基 0.625rem（官方，默认）/ 0.875rem（现行）。
// 选择写 sessionStorage 跨 app 内导航保持（卡片链接自带 search 透传，URL 参数
// 同时 replaceState 回写保持可分享）。仅 DEV 渲染，生产 build 静态折叠为 null。
import type * as React from 'react';
import { useEffect, useState } from 'react';

const VARIANTS = [
  { key: 'now', name: '现 · 纸兰（历史参考）' },
  { key: 'd', name: 'D · 冷瓷靛 Porcelain Indigo' },
  { key: 'e', name: 'E · 暖灰玫 Ash Rose' },
  { key: 'f', name: 'F · 石墨青 Signal Graphite' },
] as const;

type VariantKey = (typeof VARIANTS)[number]['key'];
type RadiusKey = 'official' | 'current';

const VARIANT_KEYS: readonly string[] = VARIANTS.map((v) => v.key);
const RADIUS_KEYS: readonly string[] = ['official', 'current'];
const VARIANT_STORE = 'proto988-variant';
const RADIUS_STORE = 'proto988-radius';

function readParam(name: string, allowed: readonly string[]): string | null {
  const value = new URLSearchParams(window.location.search).get(name);
  return value != null && allowed.includes(value) ? value : null;
}

function readStored(name: string, allowed: readonly string[]): string | null {
  try {
    const value = sessionStorage.getItem(name);
    return value != null && allowed.includes(value) ? value : null;
  } catch {
    return null; // 隐私模式等 storage 不可用——URL/默认值兜底
  }
}

function writeParams(variant: VariantKey, radius: RadiusKey): void {
  const url = new URL(window.location.href);
  if (variant === 'now') url.searchParams.delete('variant');
  else url.searchParams.set('variant', variant);
  url.searchParams.set('radius', radius);
  window.history.replaceState(null, '', url);
}

function isTypingTarget(el: Element | null): boolean {
  if (el == null) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable === true;
}

const BAR_STYLE: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 2147483000,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  background: '#101014',
  color: '#f5f5f7',
  border: '1px solid rgb(255 255 255 / 0.25)',
  boxShadow: '0 4px 16px rgb(0 0 0 / 0.45)',
  font: '12px/1.4 ui-sans-serif, system-ui, sans-serif',
  userSelect: 'none',
};

const BUTTON_STYLE: React.CSSProperties = {
  background: 'rgb(255 255 255 / 0.08)',
  color: 'inherit',
  border: 'none',
  borderRadius: 999,
  padding: '4px 10px',
  cursor: 'pointer',
  font: 'inherit',
};

function SwitcherInner() {
  const [variant, setVariant] = useState<VariantKey>(
    () =>
      (readParam('variant', VARIANT_KEYS) ??
        readStored(VARIANT_STORE, VARIANT_KEYS) ??
        'now') as VariantKey,
  );
  const [radius, setRadius] = useState<RadiusKey>(
    () =>
      (readParam('radius', RADIUS_KEYS) ??
        readStored(RADIUS_STORE, RADIUS_KEYS) ??
        'official') as RadiusKey,
  );

  // 双轴落 <html>：overlay CSS 与圆角切换都只认 dataset，持久化 + URL 回写同批。
  useEffect(() => {
    const root = document.documentElement;
    if (variant === 'now') delete root.dataset.variant;
    else root.dataset.variant = variant;
    if (radius === 'official') root.dataset.radius = 'official';
    else delete root.dataset.radius;
    try {
      sessionStorage.setItem(VARIANT_STORE, variant);
      sessionStorage.setItem(RADIUS_STORE, radius);
    } catch {
      // storage 不可用——内存态照常
    }
    writeParams(variant, radius);
  }, [variant, radius]);

  // ← → 循环切色板（输入焦点在表单件时不拦截）。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(document.activeElement)) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      setVariant((prev) => {
        const i = VARIANT_KEYS.indexOf(prev);
        return VARIANT_KEYS[(i + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length] as VariantKey;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cycle = (delta: number) =>
    setVariant((prev) => {
      const i = VARIANT_KEYS.indexOf(prev);
      return VARIANT_KEYS[(i + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length] as VariantKey;
    });

  const current = VARIANTS.find((v) => v.key === variant) ?? VARIANTS[0];
  const radiusLabel = radius === 'official' ? '圆角: 官方 10px' : '圆角: 现行 14px';

  return (
    <div style={BAR_STYLE} data-testid="proto988-switcher">
      <button type="button" style={BUTTON_STYLE} aria-label="上一个色板" onClick={() => cycle(-1)}>
        ←
      </button>
      <span style={{ minWidth: 190, textAlign: 'center', fontWeight: 600 }}>{current.name}</span>
      <button type="button" style={BUTTON_STYLE} aria-label="下一个色板" onClick={() => cycle(1)}>
        →
      </button>
      <span aria-hidden="true" style={{ opacity: 0.4 }}>
        |
      </span>
      <button
        type="button"
        style={BUTTON_STYLE}
        aria-pressed={radius === 'official'}
        onClick={() => setRadius(radius === 'official' ? 'current' : 'official')}
      >
        {radiusLabel}
      </button>
      <span aria-hidden="true" style={{ opacity: 0.55 }}>
        ←/→ 切换
      </span>
    </div>
  );
}

export function ProtoSwitcher() {
  // 生产 build 静态折叠（import.meta.env.DEV 编译期常量）。
  if (!import.meta.env.DEV) return null;
  return <SwitcherInner />;
}
