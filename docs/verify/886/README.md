# #886 验收证据索引 — Chief 卡边界看不见 / 与创建槽风格不统一

驱动 = `scripts/probe-team.mjs`（fixture 栈，`/app/team?scenario=12`，1440×732，
双主题各一遍），before/after 同脚本同坐标。

## 实测数值（改前 → 改后）

| 指标 | dark before | dark after | light before | light after |
|---|---|---|---|---|
| 卡底色 vs 画布对比度 | **1.00（同色 #1e1e22）** | **1.103（#26262b on #1e1e22）** | **1.00（同色 #e7e3da）** | **1.11（#ddd8cc on #e7e3da）** |
| 卡描边 vs 画布 | 1.103 | 1.103（发丝线并入底色档，同 res-card） | 1.049 | 1.049 |
| 创建槽虚线 vs 画布 | 1.367 | 1.367（不动） | 1.344 | 1.344（不动） |
| 卡内文字对比度（最差对） | role 行 5.19 | role 行 **4.70（仍 ≥4.5）** | model 行 5.96 | model 行 **5.37（仍 ≥4.5）** |

改前两张卡的「实线」在两个主题下都与画布同色（对比度恒 1.00）——边界只剩一条
1.05:1 的发丝线，与用户原话「没有界限的存在」一致。

## 统一到哪条既有规则

**res-card 族配方**：secondary 壳画布 = `--surface`，其上的内容卡吃背景梯度上
一档（`--surface-secondary`）+ 1px `--card-border` 发丝线——机器/模型服务/技能页
的分组卡全部如此，也正是参考产品的设计语言（`docs/design/todos.dev.md` Taste DNA
「Hairlines, Not Shadows：flat depth via background ladder + hairlines」）。
`.team-agent-card` 此前是 secondary 壳上唯一一块与画布同色的卡，改后即归队。
未新增任何 token / 样式；虚线创建槽是仓内通行的 add-slot 原语（`.res-add`
同族，r7 12 正典捕获形），与各资源页「内容卡 + 虚线添加槽」的同屏配对一致。

已知记录项（改前已存在，非本改动引入）：light 主题 `--text-dim`（#a8a29e）作
role 行文字对卡底仅 ~1.8:1——该 token 对在全部 `--surface-secondary` 卡面上
同病（机器行副文案同款），属全仓色板议题。

## 文件

`before/` `after/` 各含：`grid-{dark,light}.png`（两卡同屏裁切，deviceScaleFactor 2）、
`card-agent-{dark,light}.png`（Chief/首卡放大）、`card-create-{dark,light}.png`、
`result-{tag}.json`（上表全部数值同源）。

## 复现

```sh
cd apps/web && pnpm exec vite build --mode fixture && pnpm exec vite preview --port <p> &
BASE=http://127.0.0.1:<p> EVIDENCE_TAG=after node docs/verify/886/scripts/probe-team.mjs
```
