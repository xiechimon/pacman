// #1101 word-level diff token picker — WCAG 2.x relative-luminance contrast,
// measured not estimated (better-colors discipline). Prints, for both themes:
//   fg-on-row-bg / fg-on-word-bg   (text contrast, AA small-text gate = 4.5)
//   word-bg vs row-bg              (distinguishability of the deeper layer)
// Row-bg + fg values are verbatim from apps/web/src/styles/shadcn.css.
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const f = (n) => n.toFixed(2);
const THEMES = {
  dark: { fg: '#d3ceca', addBg: '#1a3821', delBg: '#48242a' },
  light: { fg: '#36322e', addBg: '#c3f5cc', delBg: '#ffdce0' },
};
const CANDIDATES = {
  dark: {
    add: ['#1f5c33', '#235c36', '#2a5f3b', '#1e5530'],
    del: ['#6e323b', '#77363f', '#6d2f38', '#7a2f38'],
  },
  light: {
    add: ['#8ce3a1', '#94e6a8', '#89dfa0', '#7ddc96'],
    del: ['#ffb3bd', '#ffbcc5', '#ffaab6', '#ffc0c8'],
  },
};
for (const [theme, t] of Object.entries(THEMES)) {
  console.log(`== ${theme} (fg ${t.fg}) ==`);
  for (const side of ['add', 'del']) {
    const rowBg = side === 'add' ? t.addBg : t.delBg;
    console.log(` ${side}: row-bg ${rowBg}  fg/row=${f(ratio(t.fg, rowBg))}`);
    for (const w of CANDIDATES[theme][side]) {
      console.log(
        `   ${w}  fg/word=${f(ratio(t.fg, w))}  word-vs-row=${f(ratio(w, rowBg))}`,
      );
    }
  }
}
