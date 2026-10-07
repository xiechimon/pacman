# #994 证据 — 合并闸对空授权集放行、server 403

**结论**：`missingMergeTools` 对 `agent.tools === []` 的放行是 0018 回填之前的
语义残留。回填（PR #576）把存量行补成含「推送分支」后，库里剩下的 `[]` 只剩显
式来路（权限 tab 关到最后一档 / 建号·改号 API 显式传空），而 server 侧
`requestMerge` 对 `[]` 一律拒——前端放行 = 「完成」点得动、点了必被 403 拒。
本票把它改成与 server 同判：判据未知（`null` / members 读面未到位）仍放行，空
集照报两项。

## 改动面（4 文件）

| 文件 | 改动 |
|---|---|
| `apps/web/src/detail/merge-gate.ts` | `missingMergeTools`：删掉空集放行；文件头理由段重写（旧理由已随 0018 失效） |
| `apps/web/test/merge-gate.test.ts` | 空集用例期望翻转 + 失败方式条目重写 |
| `apps/web/e2e/merge-reject.spec.ts` | 「空授权集放行」用例 → 「空授权集照拦」（两入口各钉一次，点名两项） |
| `docs/verify/994/` | 本目录证据 |

## 验证

**测试先于实现**：先翻单测期望 → `vitest run test/merge-gate.test.ts` 红
（`expected [ '合并分支', '推送分支' ] / received []`，1 failed | 6 passed）→ 改实现 → 同命令绿（7 passed）。

```
apps/web $ corepack pnpm exec vitest run test/merge-gate.test.ts   # 7 passed
apps/web $ corepack pnpm exec playwright test e2e/merge-reject.spec.ts   # 7 passed
worktree $ corepack pnpm lint      # exit 0
worktree $ corepack pnpm typecheck # exit 0（5 workspace projects 全 Done）
```

e2e 实测（`-g "空授权集照拦"` 一条）：

```
✓ e2e/merge-reject.spec.ts:214:1 › 空授权集照拦（#994）：显式全关 = 一无授权，两处入口都禁用并点名两项
```

## server 侧实物（隔离栈 A/B，`server-ab.txt`）

同相位（plan 步 claim→done → confirm → build 步 claim→done → `review`）、同端点
`POST /api/builds/{id}/merge`，唯一变量 = 执行 Agent 的 `tools`：

```
A(两开关齐备): HTTP 202 {"delegated":true}
B(授权集为空): HTTP 403 {"error":"Agent probe-B_allOff 未获「合并分支」「推送分支」授权（Agent 详情页权限 tab），无法发起合并"}
members.tools: [{"displayName":"probe-B_allOff","tools":[]},{"displayName":"probe-A_both","tools":["合并分支","推送分支"]}]
```

复现：`verify-pacman` 起栈（`VERIFY_REPO_ROOT=<repo> node .claude/skills/verify-pacman/scripts/launch.mjs`，端口 8791、scratch home）→ 跑同一支探针（建两个只差 `tools` 的 Agent + 各自一张卡推到 review + 各发一次 merge）。

## 截图

- `994-empty-tools-board-blocked.png` — 看板入口：空授权集，完成钮禁用 + 点名两项
- `994-empty-tools-detail-blocked.png` — 详情入口：同一弹层同判
- 复现：`apps/web $ PACMAN_E2E_EVIDENCE=docs/verify/994 corepack pnpm exec playwright test e2e/merge-reject.spec.ts -g "空授权集照拦"`

## 影响面核查（未受影响者）

- **fixture 面不受影响**：`useMergeGate` 在 fixture 分支收到的 `agentId` 恒为
  `null`（board-page / todo-detail-page 只在 live 分支传 `assignment.build.agentId`），
  走的是「判据未知 → 放行」那条支，从不读 fixture agent 的 `tools`。fixture 数据里
  `AGENT_R3_BUILDER.tools = []` 因此与本判据无关。
- **server 侧零改动**：本票只让前端与既有的 `requestMerge` 同口径。

## 残留

- 反向方案（server 对空集补豁免）未采用：那等于让一无授权的 Agent 能合并。
- 空集在两处产生路径（权限 tab 全关 / API 显式传空）都要用户主动操作，属显式意图。