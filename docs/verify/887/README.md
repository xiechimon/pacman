# #887 验收证据索引 — 机器卡 runtime 只留图标

驱动 = `scripts/probe-machines.mjs`（fixture 栈，`/app/resources/machines?scenario=06`，
1440×732），before/after 同脚本同坐标。

## 实测数值（改前 → 改后）

| 指标 | before | after |
|---|---|---|
| pi 容器宽 × 高 | 34×16（mark + 文字名） | **16×16（仅 mark）** |
| Claude Code 容器宽 × 高 | 98×16 | **16×16** |
| 可见文字名 | `pi` / `Claude Code` | **无** |
| aria-label（读屏名） | 无 | **`pi` / `Claude Code`**（role="img"） |
| title（悬停提示） | 无 | **`pi` / `Claude Code`** |
| 两图标间距 | 16px | **16px（排布不塌）** |
| 行高契约 | 60px | **60px** |
| mark 分态透明度 | on 1 / off 0.35 | on 1 / off 0.35（不动） |

可访问性不随文字一起删：容器 `role="img"` + `aria-label` 供读屏，`title` 供悬停；
`e2e/machines-local.spec.ts` 以 `toHaveAccessibleName`（引擎真值）+ title 属性 +
「文字名不上屏」负向三面钉死，间距 16px 与行高 60px 入几何契约。

## 文件

`before/` `after/` 各含：`runtimes-{tag}.png`（runtime 区裁切放大，deviceScaleFactor 2）、
`row-{tag}.png`（整行）、`result-{tag}.json`（上表数值同源）。

## 复现

```sh
cd apps/web && pnpm exec vite build --mode fixture && pnpm exec vite preview --port <p> &
BASE=http://127.0.0.1:<p> EVIDENCE_TAG=after node docs/verify/887/scripts/probe-machines.mjs
```
