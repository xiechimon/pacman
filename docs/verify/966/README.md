# CI flake：runner-local.test.ts「失败方式 3」跑满 5s 默认超时 —— 验证记录（966）

**结论：通过（pass）。** 修复把单测里的真实网络面（github 形态步收尾的 PR 探测）移出被测路径：同一用例从 4206ms（真实网络实测）降到 2ms；6s 慢速 `gh` shim 在修复前稳定复现 CI 签名「Test timed out in 5000ms」，修复后同条件 shim 零次被调、全部用例毫秒级绿。

## 根因

issue 的猜测是「它跑真 https clone」——实际 clone 一直是 fake（`fakeWorkspace` 录制型 WorktreeOps）。真实网络面在 `runStep` 收尾：github 形态步**成功**结束时调 `probeGithubPr`（`apps/daemon/src/runner.ts:1437` → `github-probe.ts`），走真 `gh` CLI spawn + `api.github.com` fetch 双梯，**每梯各带 10s 预算**，而该用例的预算只有 vitest 默认 5s。本文件只有失败方式 3 命中此路径（唯一 github 形态 + 成功收尾的用例），所以两次 flake 都死在它、签名恒为「恰好跑满 5000ms」而非断言红——高载 CI（165/168 workers）把网络往返拖慢即触发。

## 复现与验证方法

`gh-shim.sh`（本目录）：置于 PATH 最前冒充 `gh`，记录每次调用参数后 `sleep 6` 退出 1——模拟高载 CI 上探测的 gh 梯被拖过 5s。修复前命中即复现 CI 签名；修复后 shim 调用日志不产生 = 真实探测零发生（密封性判据）。

复跑命令（`apps/daemon/` 下执行；before 侧代码取自修复提交 `e94aff52` 的父提交 `da84ed9c` 的一次性 worktree）：

```sh
mkdir -p /tmp/gh-shim-966 && cp docs/verify/966/gh-shim.sh /tmp/gh-shim-966/gh && chmod +x /tmp/gh-shim-966/gh
env PATH="/tmp/gh-shim-966:$PATH" corepack pnpm exec vitest run test/runner-local.test.ts --reporter=verbose
```

## 证据清单

| 文件 | 内容 | 结果 |
|---|---|---|
| `before-head.txt` | before 一次性 worktree 的提交 sha | `da84ed9c…`（= 修复前基线） |
| `before-baseline.log` | 修复前、无 shim、真实网络 | 失败方式 3 = **4206ms**（同文件其余用例 1–6ms），11 passed——5s 预算只剩 ~0.8s 余量 |
| `before-shim-repro.log` | 修复前 + 6s shim | **`Test timed out in 5000ms`**（实测 5004ms），仅失败方式 3 死——与 CI 签名逐字同款 |
| `before-shim-calls.log` | shim 调用日志 | `pr list --repo o/r --head pacman/conv-conv-1 --state all …`——物理证明该用例派生真 `gh` 进程 |
| `before-create-tag-shim.log` | 修复前 runner-create-tag + shim | 3 failed / 1 passed——同根因同签名的潜伏面 |
| `before-create-tag-shim-calls.log` | shim 调用日志 | 3 次真实探测调用 |
| `after-shim-hermetic.log` | 修复后、同款 shim 在 PATH | **15/15 passed**，失败方式 3 = **2ms**，exit=0；`calls.log` 不存在（shim 零调用 = 真实探测零发生） |
| `after-daemon-suite.log` | 修复后 daemon 全量单测 | 53 文件 / **546 passed**，exit=0 |

## 修复面（详见 PR diff）

- `runner-local.test.ts`：`vi.mock('../src/github-probe.js')` 与 `runner-delivery.test.ts`（#704）同款；失败方式 3 增探测入参断言，把钉子改钉「探测消费 per-step 凭证」语义（`token: GITHUB_TOKEN.password`）；显式 `timeout: 20_000`（issue 方向 ①，高载 CI 调度噪音的双保险——探测 mock 后用例毫秒级，只有真挂会撞上限）。
- `runner-create-tag.test.ts`：同暴露（同 github repo、成功收尾、fake workspace），同款 mock。
- 不动 `runner.ts` 本体（#926 车道在改）。
