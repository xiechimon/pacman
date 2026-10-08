# #1005 波 1 L2：resources+secondary registry 对齐 — 验收证据

地图 #980 / 批次表 #991 波 1 六车道之一（E2E_PORT 8399）。原型经 HITL 实审通过
（2026-10-08 用户「全按推荐走」）后同分支续跑施工段。本目录 = 验收模板 v3 七项的实物。

## 声称 → 实物

| 验收判据（v3 七项） | 实物 |
|---|---|
| ① e2e 行为全绿（车道内本域 + 关联面；合并前本地全量一次） | `04-e2e-full.txt`：post-construction 全量 **815 passed / 2 failed**（E2E_PORT 8399）。两红均非本域行为坏：① `agent-detail.spec:613`（profile-card 逻辑角 11→13px）**重钉归 L4**（协调者裁 profile-card owner = L4）；② `segmented-controls.spec:195` 为**本机 runner 陈旧转译缓存假象**——失败帧引用的 `expect(ring.border).toBe('1px')` 代码已不在盘上（盘上 :199 为重钉后新测试、:206 为注释），隔离单跑该 spec **12/12 绿**（含新 team 测试），清 `$TMPDIR/playwright-transform-cache-*` 后全量仍复现，判定为本地 runner 读陈旧转译产物；CI 为 fresh checkout 无此缓存，以 CI 为准 |
| ② 探针重钉三方 diff（#986 机械步骤） | `probe/probe-comparison.md`（post：127 行 KEPT 127 / DRIFT 0 / VIOLATION 0）+ `probe/probe-comparison-pre-edit.md`（pre：126 KEPT / 0 DRIFT）+ 对照 #953 封版 `docs/verify/953/probe-sealed/`（全量 805 KEPT）。三方归因：sealed→pre = 批次 0（已在 verify/1002、1003 对账）；pre→post = 本车道 = 仅 team 布局钮一条几何重钉，零意外漂移 |
| ③ better-colors 本域增量面实测（不许估） | `05-contrast-increment.txt`：本域新增 fg/bg 组合 8 对 × 双模，WCAG 2.1 实测全 PASS（文本 4.5 / 图形 3.0 阈）；全局色板 #988 已双模 109 对 0 fail 封账不重测 |
| ④ verify 证据归档 + PR raw 永久链 | 本目录 + `shots/`（19 张 fixture 截图，committed 代码所建）；PR body 以 `raw.githubusercontent.com/xiechimon/pacman/<sha>/docs/verify/1005/...` 引用 |
| ⑤ 本域手写面退役对账（#983 逐条） | `06-visual-review.md` 逐面对账 + 下表 |
| ⑥ 未迁残留声明 | 见下「残留」 |
| ⑦ 非 registry 新增为零 | 未新增 components/ui 件；`02-gates.txt`：ui-registry-gate PASS（30 件 = 21 registry[14 pristine+7 登记偏离] + 9 adapters，零新增零降级）、ui-debt-gate PASS、ui-drift-gate PASS；COMPONENTS.md 无需登记新件 |

其它闸：`01-lint.txt`（biome ci 0 error）、`01b-typecheck.txt`（五包 Done）、`03-unit.txt`（web 38 文件 / 464 测试绿，含 i18n-coverage 与 ui-reuse-inventory）。

## #983 判决表落在本域的对账

| 判决件 | 本域消费点 | 执行 |
|---|---|---|
| panel→Card | profile-card.tsx（account 面） | 已迁；**所有权经协调裁决归 L4**，本分支改动保留不回退、撞取 L4 逐字；panel.tsx 本波不删（零引用核对属施工段） |
| dialog-shell 零皮化 | 4 资源 dialog + api-key-create | shell 本体冻结未动；L3 已翻面（未合 main），本域消费点自携垫在「merge main 吸收翻面」步按 L3 示范摘除（裸内容进 DialogFooter） |
| floating-shell 族拆 | account 语言 dropdown | 已迁 registry Popover（锚定 absolute 族）；外点穿透接受 Base UI 原生（2026-10-08 全局裁决，不恢复 ClickCatcher） |
| seeded-avatar 零皮 | account/team/team-chart/create-agent | 0b 已弃 contents 根改定尺盒；消费点 className size-N 同值同构，无增量动作 |
| status-chip / tag-chip / kbd-hint | 无本域消费点 | 不归本域（detail/board/chief 承载） |

## 2026-10-08 实审裁决落地

1. 组织图创建槽留 bespoke 8px（与节点族一致；#981 划出 registry 射程）= 登记偏离。
2. EmptyState 保留 `<h2>/<p>`（a11y；不降 EmptyTitle/Description 的 div）。
3. 外点穿透接受 Base UI 原生。
4. 品牌墨当文字色收敛：shell「+ 新建」与 team「设置」回 registry link 档（--primary neutral）；spot 强调保留（account 语言勾、team-chart 皇冠 on bg-(--spot-soft)）。

## 残留（未迁声明）

- `resources/parts.tsx` RES_SEARCH_*/RES_SORT_* 方角常量：唯一消费点 = agent-detail 记忆 tab（L3），L3 迁移后删。
- select.tsx 模型槽（create-agent-dialog）= #1010 波 2。
- dialog-shell 消费点自携垫摘除 = merge main 吸收 L3 翻面那一步。
- plan-dropdown（L3/L5 对表）、user-menu（L1/L3 同改）非本域文件，未动。
