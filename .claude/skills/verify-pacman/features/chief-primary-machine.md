# 单机编排默认策略：主力机（#895 / spec 21）

给 chief 落「主力机」（`chief.machineId`，null = 自动）——编排回合与 worker 步钉到同一台机器的用户语义面。三面：chief 设置 Agent tab「机器」槽（live 写 = PATCH /chief machineId 槽，行形态沿 new-task 机器 chip 的 listbox 族）；machines 页三态读标注（总管主机徽标 / 总管回合进行中 / 总管等待机器，数据 = GET /chief 封套 orchestration 块 join machines 行集）；未钉线程的 chief 步会话亲和闸（T2 对称——会话机在线他机空手）。server 缺省链/亲和闸/封套投影的单元级失败方式钉在 `apps/server/test/machine-pin.test.ts`（#895 三段）与 `chief-affinity.test.ts`。

## Sub-features

- `settings-machine-slot` — 设置 Agent tab「机器」行：`button[aria-label="机器"]`（值 = 机器名或「自动」）开 popover（`[role="dialog"][aria-label="机器"]`，listbox 语义在内层 `[role="listbox"][aria-label="机器"]`）；自动行 + 机器行（online dot 如实离线灰）；选定 = PATCH chief machineId 槽 → invalidateAll 重取回显（无本地乐观态）。aria-label 独立命名（机器 vs 压缩模型的 `button[aria-label="压缩模型"]`）——e2e strict mode 钉单元素，共名会打红（#950 载体迁移：旧 `chief-host*` / `button.chief-select` 类钩退役）。
- `machines-annotations` — machines 页 `[data-orchestration="host|running|waiting"]` 三态读标注（标注节点零 button 零 menu——行内活控件纪律 = shell 闸恰一个；#944 载体迁移：原 `.mach-orchestration*` 容器/状态类退役，三态只走 data-orchestration 属性承载，machines-chief-state.spec 同 canon）；无标注数据的行零节点（存量 capture 零漂移）。
- `default-chain` — 新线程钉选缺省链：`todo.machineId`（orchestrate 入口）→ `chief.machineId` → null；既有线程不回写。
- `failure-copy` — 主力机离线超宽限（10 分钟）的失败行点名机器 + 出口文案含「改 chief 设置的主力机」「清回自动」。
- `envelope-orchestration` — GET /chief 封套 `orchestration` 块：`defaultMachineId` + per 机 `{running, waiting}`（waiting = 被钉 pending × 该机不可执行——离线或 runtime 闸关）。

## How to get to it (user POV)

- 抽屉齿轮 → 总管设置 → Agent tab「机器」槽选机器（或「自动」）。
- machines 页看三态标注；chief 抽屉看回合失败行。

## Driving it with drive-895-primary-machine.mjs

Preconditions: `launch.mjs` 已起隔离栈（全新库）；proxy env 全 unset。

- 一键全链（14 条断言）：`env -u http_proxy -u https_proxy -u all_proxy VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/drive-895-primary-machine.mjs` → 控制台 PASS/FAIL + `evidence:<目录>`（result.json + 5 截图 + 5 API JSON）。
- 链路：设置面真用户路径选主力机（PATCH 回读 + 封套投影）→ 抽屉 composer 发新主题 → SQLite `chief_thread.pinnedMachineId` 行级真值 → 他机 claim 空手（长轮询等满 ~75s）→ machines 徽标（截图）→ 直写 DB 置离线 → waiting=1（API JSON + 截图）→ 步龄直插超龄 + scheduler tick 15s → 失败行（会话 API JSON + 抽屉截图）→ 失败后 waiting 归零（截图）。
- 铺底全走公开 REST（provider + agent + 双 key 双机 enroll——**enrollment 按 key/team 认机器，双机必须各持各的 api-key**，同 key 重注册会顶掉第一台的行）；机器在线位与步龄直写 DB（生产置位 = presence SSE / 真实时间流逝，单测同律）。

## Gotchas

- SQLite 列名 = drizzle 的 camelCase 原名（`"createdAt"`/`"buildId"`），SQL 里要引号——裸 snake_case 会 `no such column`。
- 空手 claim 走生产长轮询（~75s hold）——probe 的该步必须给 ≥100s 超时，8s 短超时会把合法等待误判成网络错。
- 机器菜单行数断言：`[role="option"]` 计数含「自动」行（自动行的 testid 是 `chief-host-auto`）；`[data-testid="chief-host-row"]` 只数机器行。useMachines 是异步查询——先等目标行 visible 再数总数（加载态会数少）。
- 亲和/失败链的真值（等待计数回零、失败后徽标保持）在 N13/N14——失败行落库后 orchestration 即时重算，别在失败前截图冒充「等待归零」。
- spec §已知边界三条（换主力机存量线程不跟 / 亲和楔住无超时 / 在飞回合随机器死亡）**不在 probe 面**——别顺手验，各有重开条件。

## Where the fixtures/e2e cover the rest

fixture 面回归（槽形/清单/accept 律、三态标注展示形与零控件纪律）= `apps/web/e2e/chief-settings.spec.ts`（机器槽段）+ `apps/web/e2e/machines-chief-state.spec.ts`（scenario `machines-chief-state` / `101-machines`）。
