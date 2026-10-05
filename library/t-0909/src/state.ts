// PROTOTYPE URL state (#909): single source for variant/face/mode, synced
// both ways with the query string (shareable + reload-stable).

export const VARIANTS = {
  a: { key: 'a', name: 'A · 石墨', hint: '无彩色品牌 / 锐利几何' },
  b: { key: 'b', name: 'B · 青墨', hint: 'teal 品牌 / 均衡几何' },
  c: { key: 'c', name: 'C · 纸兰', hint: '暖纸 + orchid / 柔和几何' },
} as const;

export const FACE_LABELS = {
  board: '看板',
  detail: '详情',
  overlay: '弹层',
  search: '搜索',
  resources: '资源',
} as const;

export type ProtoState = {
  variant: keyof typeof VARIANTS;
  face: keyof typeof FACE_LABELS;
  mode: 'dark' | 'light';
  /** break-ui stress dataset */
  data: 'normal' | 'worst';
};

export function readState(): ProtoState {
  const p = new URLSearchParams(window.location.search);
  const v = (p.get('variant') ?? 'b').toLowerCase();
  const f = p.get('face') ?? 'board';
  const m = p.get('mode') ?? 'dark';
  const d = p.get('data') ?? 'normal';
  return {
    variant: v === 'a' || v === 'c' ? v : 'b',
    face: f in FACE_LABELS ? (f as ProtoState['face']) : 'board',
    mode: m === 'light' ? 'light' : 'dark',
    data: d === 'worst' ? 'worst' : 'normal',
  };
}

export function writeState(s: ProtoState) {
  const p = new URLSearchParams();
  p.set('variant', s.variant);
  p.set('face', s.face);
  p.set('mode', s.mode);
  if (s.data === 'worst') p.set('data', 'worst');
  window.history.replaceState(null, '', `?${p.toString()}`);
  const html = document.documentElement;
  html.dataset.variant = s.variant;
  html.classList.toggle('light', s.mode === 'light');
}
