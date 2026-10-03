# #751 证据：chief 模型选择器（弹层锚定 + 选中行可见性）

栈：本 worktree 的 fixture 构建（`vite build --mode fixture` + `vite preview`，
127.0.0.1:8410，strictPort），Playwright chromium，viewport 1440×732，
`/app?scenario=111`，主题经 `localStorage pacman-theme` 切换。探针脚本逻辑：
开面前后各读一次触发钮 rect（两态必须一致）、开面后读弹层 rect 与选中行
name 的 computed color / 实际渲染背景（向上走第一个非透明背景），WCAG
对比度在探针内计算；截图为整视口。

| 文件 | 内容 |
| --- | --- |
| `user-reported.png` | 用户 2026-10-03 原报截图（抽屉头模型行触发位） |
| `before-light.png` / `before-dark.png` | 改前：居中 DialogShell（视口中段）+ 选中行名不可读 |
| `before-rects.json` | 改前 rect 与对比度：弹层 (496, 303.7) 448×124.6，距触发钮底 248.2px、左偏 -540px；选中行名对比度 light 1.24:1 / dark 1.57:1 |
| `after-light.png` / `after-dark.png` | 改后：弹层贴触发行底下（gap 4px、左缘齐平），选中行 indigo tint + 墨 + check |
| `after-rects.json` | 改后 rect 与对比度：弹层 (1036, 59.5) 280×81.5，gapBelowTrigger 4、leftDelta 0；选中行名对比度 light 5.45:1 / dark 5.21:1（13px 正文 AA 阈 4.5） |

e2e 侧同口径钉扎：`apps/web/e2e/chief-drawer-model.spec.ts` 断言弹层 rect
对触发钮 rect（±2px）、弹层落在抽屉列内、两主题下选中行 computed 对比度
≥ 4.5 且选中行带填充（非纯颜色载义）。受影响面全量 654 passed + 本 spec
6/6 passed。
