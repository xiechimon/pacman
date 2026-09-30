# 创建 Agent 弹窗「模型」区：模型很多时的显示与可选性（票 XMON-40）

> 目录名用 issue identifier（本票来自 Multica 票池，无 GitHub 编号可挂），不进 `docs/verify/<GitHub 票号>/` 序列。

## 结论

**通过。** 待验分支 `b5baff11` 上，创建 Agent 弹窗的模型选择区在 46 条候选下：菜单整体落在弹窗体裁剪盒内、无行被切、可滚动、逐行可达、46 条全部点得中且回显正确。

同一驱动跑在修复前的父提交（`38c945b9` = `b5baff11^`）上是 8/13——失败的 5 条正是用户报的症状（「未设置模型」+ 前两个模型被 `.dlg-body` 裁掉，永远点不中）。**驱动能红**，故修复后的 13/13 不是空过。

## 待验对象

| 项 | 值 |
|---|---|
| 分支 | `agent/pacman/780d00d25e07` |
| HEAD | `b5baff11`（校验：本地 HEAD 与 `origin/agent/pacman/780d00d25e07` 同 SHA） |
| 对照 | `38c945b9`（`b5baff11^`，修复前） |
| PR | #550（验证期间 state=open，未合并） |

## 验收标准（唯一依据）

issue 原文：「创建 Agent 时，里面的模型设置中模型太多，显示区域这边有 bug。」

拆成四条可证伪的判据，逐条实测：

1. **不溢出** — 菜单容器不越出视口，也不越出弹窗体的裁剪盒（`.dlg-body`，`overflow-y: auto`）。
2. **不裁切** — 没有任何一行被容器边缘切掉后不可达。
3. **不破版** — 含超长模型名的行不撑破宽度。
4. **可正常浏览 + 所有模型都能被正常选中** — 列表可滚动、逐行滚得到完整可见；每一条点下去都生效。

## 「模型太多」这个条件是怎么来的

本机 fresh 栈上，创建弹窗的真实候选只有 **6 条**（5 个 Claude Code 槽位模型 + 「未设置模型」行）——`GET /api/teams/:id/providers` 为空、`GET /api/teams/:id/model-sources` 的 claude-code 段 5 条（用户自己的 8787 栈读出来同样是 5 条）。这个规模复现不出用户报的症状。

所以验证跑了两个规模：

- **基线**：栈自带的真实候选（6 条），未做任何扩量。
- **「太多」**：经**应用自己的「添加服务商」表单**（模型服务页 → 新建 → 自定义端点）写入一个 40 模型的 custom provider，候选变 46 条。数据是真用户路径写进真库的，不是在 DOM 上造假。

40 条里每第 4 条用超长模型名（`xmon40-model-with-a-very-long-identifier-NNN-v1-preview`），覆盖「破版」这条。

## 驱动脚本

`integration/verify/xmon-40-agent-model-menu.mjs`（验证角色属地，不改 `apps/` `packages/` 任何文件）

```sh
# 起隔离栈（verify-pacman launch.mjs；本机 8791 被别的车道占，故换 8792/5274）
VERIFY_REPO_ROOT=<worktree> VERIFY_PORT=8792 VERIFY_WEB_PORT=5274 \
  node .claude/skills/verify-pacman/scripts/launch.mjs
node integration/verify/xmon-40-agent-model-menu.mjs
```

harness 事实：栈 = `apps/server`（tsx，独立 `PACMAN_HOME` scratch）+ vite dev（proxy `/api`）。驱动走 live 面（URL 不带 `?scenario=`），Playwright chromium，视口 1440×732（与 e2e canon 同口径）。

几何口径：**有效可见区 = 视口 ∩ 所有 `overflow` 非 `visible` 的祖先**。只按菜单自身矩形算可见度会漏掉本票的形态——菜单本身画得好好的，是被祖父级 `.dlg-body` 裁掉的。

## 实测输出

### 修复后 `b5baff11` — 13/13

```
ok   baseline: 真实候选（未扩量）菜单在视口内、无行被切 — options=6 box=248..440 vp=732
ok   seed: 自定义服务商经应用表单建成且模型数对账 — providers=1 models=40 期望=40
ok   many: 候选条数 = 数据源并集数 + 「未设置模型」行 — options=46 期望=46
ok   many: 菜单容器整体落在视口内（不溢出） — top=248 bottom=440 视口高=732
ok   many: 列表可滚动（可正常浏览） — overflow-y=auto scrollHeight=1414 clientHeight=190
ok   many: 菜单不被弹窗体裁剪盒切掉任何一行（不裁切） — 菜单盒 248..440 裁剪盒 240..492 被切行数=0
ok   many: 含超长模型名的行未撑破宽度（不破版） — 行内横向溢出=0
ok   many: 打开瞬间首行完整可见（「前几行被裁不可点」不复现） — 首行「未设置模型」可见高=31/31
ok   many: 滚到底后末行完整可见（浏览可达末端） — 末行「MiniMax-M3[1M]Claude Code」可见高=31/31
ok   many: 每一条都能被滚到完整可见（不裁切） — 可达 46/46
ok   many: 每一条都能被选中且回显正确（所有模型都能被正常选中） — 选中 46/46
ok   short: 1366×600 与 1440×500 下菜单仍在视口内、不被切且首行完整 — 1366x600: top=182 bottom=374 vp=600 maxH=192px 被切=0 / 1440x500: top=132 bottom=324 vp=500 maxH=192px 被切=0
ok   全程无页面错误 — 0 条

13/13 checks ok
```

### 修复前 `38c945b9`（同驱动、同条件）— 8/13

```
ok   baseline: 真实候选（未扩量）菜单在视口内、无行被切 — options=6 box=247..440 vp=732
ok   seed: 自定义服务商经应用表单建成且模型数对账 — providers=1 models=40 期望=40
ok   many: 候选条数 = 数据源并集数 + 「未设置模型」行 — options=46 期望=46
ok   many: 菜单容器整体落在视口内（不溢出） — top=140 bottom=440 视口高=732
ok   many: 列表可滚动（可正常浏览） — overflow-y=auto scrollHeight=1414 clientHeight=298
FAIL many: 菜单不被弹窗体裁剪盒切掉任何一行（不裁切） — 菜单盒 140..440 裁剪盒 240..492 被切行数=4
ok   many: 含超长模型名的行未撑破宽度（不破版） — 行内横向溢出=0
FAIL many: 打开瞬间首行完整可见（「前几行被裁不可点」不复现） — 首行「未设置模型」可见高=0/31
ok   many: 滚到底后末行完整可见（浏览可达末端） — 末行「MiniMax-M3[1M]Claude Code」可见高=31/31
FAIL many: 每一条都能被滚到完整可见（不裁切） — 可达 42/46 不可达：[{"i":0,"name":"未设置模型","visibleInClip":0,...},{"i":1,"name":"xmon40-model-000","visibleInClip":0,...},{"i":2,"name":"xmon40-model-001","visibleInClip":0,...},{"i":3,"name":"xmon40-model-002","visibleInClip":27,"h":31,...}]
FAIL many: 每一条都能被选中且回显正确（所有模型都能被正常选中） — 选中 43/46 失败：[{"i":0,"why":"点击失败：TimeoutError: locator.click: Timeout 5000ms exceeded."},{"i":1,...},{"i":2,...}]
FAIL short: 1366×600 与 1440×500 下菜单仍在视口内、不被切且首行完整 — 1366x600: top=74 bottom=374 vp=600 maxH=300px 被切=4 / 1440x500: top=24 bottom=324 vp=500 maxH=300px 被切=4
ok   全程无页面错误 — 0 条

8/13 checks ok
```

对照两边的 `02-many-models-open.png` 一眼可辨：修复后首行是「未设置模型」，修复前首行被切到只剩 `xmon40-model-002`——上面那两行半在裁剪带里，既画不出也点不中（Playwright 的 actionability 检查 5s 超时）。

## 证据

| 目录 | 内容 |
|---|---|
| `2026-10-01-fixed-b5baff11/` | 待验分支 `b5baff11` 的一次完整跑：`result.json`（13 checks 全 ok + 全部几何原始值）+ 6 张截图 |
| `2026-10-01-prefix-38c945b9/` | 对照父提交 `38c945b9` 的同驱动跑：`result.json`（8/13）+ 6 张截图 |

截图口径（两个目录同名）：`01` 基线 6 条候选 / `02` 46 条候选打开瞬间 / `03` 滚到底 / `04` 逐条点选走完后（回显 = 最后一条 claude-code 模型）/ `05` 1366×600 与 1440×500 两个矮视口。

## 未覆盖（记账）

- **提交链**：本轮只验显示区与选中回显，没有点「创建」提交，未验证选中的 provider/modelId 是否随 `POST /api/teams/:id/agents` 落到 agent 记录上——那是创建链的验收面，不在本票标准里。
- **键盘路径**：只用指针点选，未验方向键/Enter 的可达性。
- **超出弹窗体的极矮视口**（如 1440×400）：未测；1440×500 已通过。