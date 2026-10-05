# t-0909 — 全站视觉方向重选原型（PROTOTYPE, throwaway）

#909 的候选视觉方向沙盒：三套色板 × 几何语言，渲在五个代表面（看板卡片 /
详情页 / 弹层 / 搜索 / resources 列表 + 常驻侧栏）上，供用户实审定版。
**不是产品代码**——定版后赢的方向按施工票重写进 apps/web，本目录整体退役。

## 跑

```sh
corepack pnpm install --ignore-workspace   # 独立锁文件，不进 workspace
corepack pnpm dev                          # http://localhost:5199（strictPort）
```

URL 参数（可分享、刷新稳定）：

- `?variant=a|b|c` — 视觉方向（浮动底栏 ← → 或键盘方向键切换）
- `?face=board|detail|overlay|search|resources` — 代表面（底栏切换）
- `?mode=dark|light` — 明暗（底栏切换）
- `?data=worst` — break-ui 最坏数据（底栏「最坏数据」开关）

## 三个方向

| 键 | 名 | 色相 | 几何 |
| --- | --- | --- | --- |
| a | A · 石墨 Graphite | 无彩色品牌（黑白骨架承明度，彩色只给五状态） | 4px 锐角、发丝线承重、零扩散投影、mono 微标签、高密度 |
| b | B · 青墨 Teal Ink | 冷石墨骨架 + teal 品牌 | 8px 圆角、卡级微影、中密度 |
| c | C · 纸兰 Paper Orchid | 暖纸骨架 + orchid 品牌 | 14px 圆角、分层软投影、宽松留白 |

## 色板怎么来的

`scripts/gen-palettes.mjs`（culori，oklch 角色 ramp）生成 `src/themes/{a,b,c}.css`，
每套含明暗双模全语义 token（官方 shadcn 槽 + 仓内补位族 + #787 P0 语义槽公式原样）。
对比度逐对 **WCAG 2.1 实测**（非估计），未过对按「只动明度」自动修正后复测：
`reports/contrast.md`（三套 × 双模，0 未过）。参考站品味核对：
`reports/taste-crosscheck.md`（todos.dev 2026-10-05 匿名实测）。

## 面与件的来源

`src/components/ui/`、`src/icons/`、`src/i18n/`、`src/styles/{motion,fonts,dialog}.css`
自 apps/web 原样拷贝（真件真皮肤）；`src/shims/shared.ts` 与
`src/overlays/dismiss.tsx` 是最小桩。五个面（`src/surfaces/`）是 mock 渲染，
数据形状镜像真 fixtures（zh-CN 权威语言）。状态 chip 走 Badge 骨架 +
五态 token 对 = map fog 里「chip → badge 适配层」的预览答案。

## 证据

`screenshots/` — 三方向 × 代表面 × 明暗 + 最坏数据 + 参考站实拍。
