# #753 看板拖拽矩阵重定——证据

t-0101 的重测结论（本仓旧规则「待处理/已完成不可拖、待处理不接受任何落位」
与参考站现状不符）经 ego-browser 一手重测钉实（`ref/` 29 张截图，
scenario 全对照），按来源重定的落位矩阵见票面。本目录存改动后的验收证据。

## 方法

- 栈：`vite build --mode fixture` + `vite preview`，Playwright chromium
  headless，1440x732，dark，scenario 22（待开始/待处理/已完成各一探针卡）。
- 手势：同一脚本同一视角（`record-reopen.mjs` / `record-pending-lift.mjs`
  要点：mouse.down → 阈值外小步抬升 → 目标列悬停 600ms（两级染色可见）→
  下移落位行 → 松手 → 800ms 收尾）。
- before：`origin/main` 一次性 worktree（`/tmp/pacman-753-before`，已清），
  8411；after：本分支，8412。录制脚本与本目录 GIF 同参。
- 录屏：Playwright recordVideo（25fps webm）→ ffmpeg palettegen/paletteuse
  转 GIF（12fps，720px 宽）。

## Before / After

- `before-reopen.gif` — done(有变更) 卡按住拖：无抬升、无染色、无提交
  （旧 `draggable=false` + `disabled: !draggable`，传感器不武装）。
- `after-reopen.gif` — 同手势：抬升紧凑卡（2° 倾角）→ 待开始戴 base 档、
  待处理悬停升 hover 档、执行中与源列恒素面 → 松手静默落位待处理（写
  review，重开回审核关口），counts 1/0。
- `before-pending-lift.gif` — 待处理(confirm) 卡按住拖：全片静置，无抬升。
- `after-pending-lift.gif` — 同手势：抬升 → 待开始/已完成戴 base 档、
  执行中恒素面、源列恒素面 → 落已完成静默提交（手动验收捷径）。

## 参考站对照（`ref/`，ego-browser 一手实测，todos.dev）

- 待处理/已完成列的卡按压超阈值即进 grabbing（旧「不可拖」误判推翻）；
- 两级 indigo 染色：合法目标 base 5%（`rgba(99,102,241,0.05)`），悬停列
  10%（`0.1`），源列与非法对恒素面；
- done(有变更) 卡拖拽时待处理戴 5%/10%，无变更的 done 卡恒素面
  （hasChanges 数据闸的来源）；
- 待开始→待处理恒素面（#351 该对保留）；非法落位静默无操作（无拒绝动画）；
- 落执行中弹 开始任务 dialog（本仓走 #640 startGate 路由，不本地写相位）；
- 落已完成 = 静默提交；done→todo = uncomplete 语义（本仓载体统一为
  PATCH phase，wire 差异归后续票）。

## 验证

- e2e 受影响面 `pnpm --filter @pacman/web e2e:affected`：693 passed
  （5.3min）。唯一红灯 `token-gate.spec.ts:124` 是负载型 flake—— дважды
  都是 `beforeAll` 里两个真 server（`tsx` 子进程）30s 起不完；机器安静后
  本分支单跑 4/4（6.5s），`origin/main` 同栈同跑同样 4/4（6.4s），手动起
  本分支 server 也一次 200——与本次改动无关（改动面：board 拖拽 + phase
  手动矩阵；token-gate 备忘：真 server 双起 + 30s beforeAll 在多 lane
  满载机上是已知紧张预算）。
- unit：`vocabulary.test.ts` + `columns.test.ts` + `dnd.test.ts`，67/67。
- server：`manual-drop-matrix.test.ts`（HTTP PATCH 面状态码 + `{error}`
  形状），14/14。
- `pnpm typecheck` 5/5；`pnpm lint`：本次 16 个文件 0 error——全树另有
  5 个报错文件（`builds.ts`、`failed-review-restore.test.ts`、
  `machine-pin.test.ts`、`runner-images.test.ts`、`composer-wire.ts`），
  均为本分支未碰的已提交态（base 自带红，见报告）。
