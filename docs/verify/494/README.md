# 资源页滚动条贴面板右缘验证（票 #494）

承接 #486。那票修好了「滚不动」，但滚动容器是 768 窄列 `.res-col`，滚动条跟着悬在
版心右缘（x=1224），离面板右缘 216px；经典（非覆盖式）滚动条还会从版心啃掉约 15px。

本票把「滚动容器」与「窄列」两个角色拆开，对齐兄弟面板 `secondary` 的现成分段：

```text
<header .res-topbar>          ← 滚动容器外，保持钉住
<div    .res-body>            ← 全宽，承接滚动（flex:1 + overflow-y:auto）
  <div  .res-col>             ← 768 窄列，只在里面居中，自身不滚
```

## 证据形态

**成对驱动**：同一场景（隔离栈 + scratch 技能目录铺 25 个技能 + 1440×732 + 真滚轮 12
档）分别驱动两套栈，两侧只差这次的结构拆分：

- `before-scroll-on-col/` = 主检出（post-#486，滚动在窄列 `res-col`）
- `after-scroll-on-body/` = 本 lane（滚动在全宽 `res-body`）

跑法：`node .claude/verify-run/evidence-494.mjs <ports.json|self> <outDir|self> <label>`。
滚动层靠「从窄列往上找第一个真在滚的祖先」定位，不钉类名——量的是用户可见性质。

## 读数

| 量 | before（滚动在窄列） | after（滚动在全宽 body） |
|---|---|---|
| 滚动层 | `.res-col` | `.res-body` |
| 滚动层右缘 / 面板右缘 | 1224 / 1440（**差 216px**） | 1440 / 1440（**差 0**） |
| scrollHeight / clientHeight | 2048 / 688 | 2048 / 688 |
| 滚轮 12 档后 scrollTop | 1360 | 1360 |
| 末行 top / bottom | 668 / 732 | 668 / 732 |
| checks | **6/7**（`scrollbar-at-pane-right-edge` 红） | **7/7** |

两轮一致的量（证明拆分零漂移）：`.res-col` x=456 宽=768、topbar y=0 高=44、
`window.scrollY`=0 且 document 不可滚、末行可达性相同。

注意 before 的 `last-row-reachable-by-wheel` 是**绿**的——#486 的修复在 before 里已
生效。本票只挪滚动条位置，不改变「能不能滚」，两轮 `scrollTop` 同为 1360 即是证据。

## 回归钉扎

`apps/web/e2e/skills-readonly.spec.ts` 的 #486 用例扩为 #486/#494 双票用例：走链定位真
滚动层 → 断言其右缘对齐 `.res-main-col` 右缘且比 `.res-col` 宽（② 红态即本票原始症状）。
改动前实测红在 `Expected: 1440 / Received: 1224`，差 216。

## 门禁

18 个资源相关 spec 155/155 绿（含钉 `.res-col` 几何的 `providers-tabs`、钉
`.res-main-col` 的 `chief-panel`）；全量 e2e 与 `pnpm test` 见 PR。

## 归档说明

两轮各含 `result.json` + 三张截图（`01-arrival` 到达态、`02-after-wheel` 滚轮后、
`03-scrolled-bottom` 滚到底），截图在两个子目录内。根 `result.json` = 修复后那轮，
`archive.mjs` 的清单行只数顶层 png，故显示「0 张截图」——实际 6 张在子目录。