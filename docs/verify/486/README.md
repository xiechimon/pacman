# 资源页面板滚动修复验证（票 #486）

resources 五页（skills / mcp-servers / providers / machines / secrets）在内容高于
视口时无法滚动——`.res-col` 的 `overflow: hidden` 把 flex item 的自动最小高度归零，
列收缩到剩余高度后溢出即被裁。修法 = `overflow-x: hidden` + `overflow-y: auto`
（同 `.secondary-body` 形，滚动落在面板体自身，topbar 保持钉住）。

## 证据形态

**成对驱动**：同一场景（隔离栈 + scratch 技能目录铺 25 个技能 + 1440×732 + 真滚轮
12 档）分别驱动两套栈，两侧只差这一条声明：

- `before-unfixed/` = 主仓检出（`839f59e`，未修）
- `after-fixed/` = 本 lane（`web/486-res-col-scroll`，已修）

跑法：`node .claude/verify-run/evidence.mjs <ports.json> <outDir> <label>`（栈经
`launch.mjs` 起；lane 侧 `VERIFY_PORT=8792 VERIFY_WEB_PORT=5274`）。

## 读数

| 量 | before（未修） | after（已修） |
|---|---|---|
| 行数（UI / API / 铺底） | 25 / 25 / 25 | 25 / 25 / 25 |
| `.res-col` scrollHeight / clientHeight | 2048 / 688 | 2048 / 688 |
| 溢出高度 | 1360px | 1360px |
| `overflow-y` | `hidden` | `auto` |
| 滚轮 12 档后 `colScrollTop` | **0**（不动） | **1360**（到底） |
| 末行 top / bottom | 2028 / 2092 | 668 / 732 |
| checks | **5/6**（`last-row-reachable-by-wheel` 红） | **6/6** |

修复前后一致的量（证明零漂移）：`.res-col` 盒 x=456 宽=768、topbar y=0 高=44、
`window.scrollY`=0 且 document 不可滚（固定高度外壳架构未变）。

## 五页覆盖面

`.res-col` 的唯一渲染点是 `resources/shell.tsx`，五页共用。修后逐页实测 computed
值：

```
OK   /app/resources/skills          overflow-y=auto overflow-x=hidden width=768
OK   /app/resources/mcp-servers     overflow-y=auto overflow-x=hidden width=768
OK   /app/resources/providers       overflow-y=auto overflow-x=hidden width=768
OK   /app/resources/machines        overflow-y=auto overflow-x=hidden width=768
OK   /app/resources/secrets         overflow-y=auto overflow-x=hidden width=768
```

## 回归钉扎

`apps/web/e2e/skills-readonly.spec.ts` 新增一例（先于实现写、先红后绿）：stub
20 行技能 → 守卫断言确有溢出 → 真滚轮手势 → 末行完整进入视口，并连带钉住列宽
768、topbar 44 与 `window.scrollY`=0。手势用滚轮而非 `scrollTop` 赋值——后者在
`overflow: hidden` 下照样生效，分不出「能滚」与「被裁」。

相关面全量 e2e（18 个 spec，含钉 `.res-col` 几何的 `providers-tabs` / `chief-panel`）
152/152 绿，像素零漂移。

## 归档说明

两轮各含 `result.json` + 两张截图（`01-arrival` 到达态、`02-after-wheel` 滚轮后），
截图在 `before-unfixed/` 与 `after-fixed/` 子目录内。根 `result.json` = 修复后那轮，
`archive.mjs` 的清单行只数顶层 png，故显示「0 张截图」——实际 4 张在子目录。