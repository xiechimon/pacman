# #938 验证证据索引 —— squash 合并下的清场脚本

对象：`scripts/cleanup-merged-branches.sh`（判据 = GitHub merged PR 列表，不猜祖先关系）。
验收方式：本仓真实分支残留上的实跑（squash 合并下无法用祖先关系构造判据，故双向都用
真分支：真已合残留 → 该清；真未合分支 → 不该动）。失败方式枚举正本 = 脚本头注释
（9 条），本目录 transcript 与之对应。

## 脚本版本注记

验收跨三个脚本状态，transcript 按版本前缀区分：

| 版本 | 内容 | Transcripts |
|---|---|---|
| v1 | 初版（无守卫 9） | `t2/t3/t4-*-t0194.txt`、`full-dry-run-prefix-v1.txt` |
| v2 | + 守卫 9（tip == merged headRefOid） | `t1-*`、`t5-*`、`t7-*`、`t9-*`、`r1/r2/r3-*`、`full-dry-run.txt` |
| v3（随 PR 交付版） | 评审修整：`keep()`/`lookup()` 收敛、变更型 git 调用 `</dev/null`、per-op 日志截断、`OPEN_LIMIT` 可覆写 | `v3-*.txt` |

v1→v2 只加守卫（KEEP 方向收紧，不改已证的清理路径）；v2→v3 是纯管线重构（判定逻辑
零变化，由 v3 全仓 dry-run 与 v2 决策一致佐证）。票面点名 fixture（t-0194）跑于 v1，
其 tip 经审计 == merged head（见下），守卫 9 对它 no-op，判定与终版一致。

## 验收矩阵（票面双向 + 幂等 + 守卫红/绿）

| 面 | 主证（终版 v3） | 补充/历史 | 结果 |
|---|---|---|---|
| 该清：正例四连环 = dry 三面计划 → 弄脏 KEEP → 净跑 CLEANED（worktree+本地+远端）→ 四重消失核验 → 幂等重跑 | `v3-positive-fourface-impl105.txt`（impl/105-react-router-8，PR #118） | `t3-clean-{dry,yes}-t0194.txt` + `t4-idempotent-t0194.txt`（票面点名 fixture，v1；yes 篇尾附会话捕获的三面消失核验） | 全 PASS，exit 0 |
| 不该动：未合分支 + worktree，dry 与 `--yes` 双跑 | `t1-unmerged-keep-{dry,yes}.txt`（v2；yes 篇尾附 fixture 三面完好核验） | — | KEEP「not in the GitHub merged-PR list」，零改动 |
| 不该动：活跃车道（有机实案，非构造） | `v3-keep-active-lane-open-pr.txt` | — | KEEP「open PR #1014 still uses this branch name」（守卫 2 实证） |
| 脏 worktree 守卫 + `--force-dirty` | `v3-positive-fourface-impl105.txt` §2 | `t5-dirty-keep-force-dirty-impl104.txt`（v2 全链：KEEP → force CLEANED → 幂等） | 无 flag 必 KEEP，有 flag 才丢弃 |
| 守卫 9 红/绿：合并后同分支续跑 | `v3-full-dry-run.txt` 内 7 条有机 KEEP（见下节） | `t9-oid-guard-impl106.txt`（v2 构造红/绿：空提交越过合并头 → KEEP；还原 tip → CLEANED） | tip != merged head 必 KEEP |
| 失败方式 1：无 gh / gh 网络死 / git 网络死 | `v3-r1-no-gh-abort.txt`、`v3-r2-gh-network-abort.txt`、`v3-r3-git-network-abort.txt` | `r1/r2/r3-*`（v2） | 三路 exit 2 中止，绝不降级猜测；验收当晚代理多次真实抖动，中止路径被天然反复实锤 |
| 失败方式 7：执行中远端删除网络断（天然实锤） | — | `t7-remote-delete-network-fail-impl104.txt`（v1）：worktree+本地已删、push 断 → 单行 FAIL、exit 1；残面由 t5 终跑补全 | 单点失败不扩散、如实报告 |
| 全仓 dry-run（只读） | `v3-full-dry-run.txt`：218 WOULD-CLEAN / 67 KEEP | `full-dry-run.txt`（v2：219/68）、`full-dry-run-prefix-v1.txt`（v1：229/61） | exit 0 |

三轮全仓 dry 的差额可逐条对账：v1 229 = v2 219 + 3（ci/e2e-merge-gate-762、impl/104、
impl/106 在两轮之间被验收实跑清掉）+ 7（守卫 9 上线翻成 KEEP）；KEEP 61 + 7 = 68。
v3 218 = 219 − 1（impl/105 被 v3 正例清掉）；67 = 68 − 1（负例 fixture 分支已撤）。

## 已删 tip 的 OID 审计

`oid-audit-deleted-tips.txt`：验收过程真删的每条分支（t-0194、ci/e2e-merge-gate-762、
impl/104、impl/106、impl/105），被删 tip 与对应 merged PR 的 head.sha **5/5 全 40 位
hex 相等** —— 清掉的全部是已落地工作的残留，零未合提交损失。审计通道 = GitHub REST
（`pulls/<n>` → `.head.sha`）经直连主机取数，不经本机代理。

## 守卫 9 的有机证据（v3 全仓 dry-run）

`v3-full-dry-run.txt` 中 7 条 KEEP 带「has commits past the merged head」：
`pacman/conv-01a10c27-…`、`ui-reuse`、`web/442-chief-hotkey-cmdj`、
`web/443-444-chief-fab`、`web/445-board-topbar`、`web/448-mention-center`、
`xmon-18-status-row` —— 都是合并后本地又长过提交的真分支；若无守卫 9，它们会进清理计划。

## 验收期清场副作用记录（如实）

验收在真实残留上实跑，共回收 5 条已合残留：`hp/pacman/t-0194-932-320px-933`（三面）、
`ci/e2e-merge-gate-762`（三面；早期 harness 的选支过滤器未排除已带 worktree 的分支而
选中它——该 worktree 干净、无 herdr workspace 锚定、PR #764 已合，核验为无害正当回收）、
`impl/104-ts-upgrade`（三面）、`impl/106-tailwind-4`（本地+远端）、
`impl/105-react-router-8`（三面）。负例 fixture（`hp/pacman/t-0222-938-negfixture`，
无 PR 的自建分支）验收后手工撤除。终版 harness 改为显式点名分支，不再按模式选支。

## 复现

```sh
# 全仓计划（只读）
bash scripts/cleanup-merged-branches.sh
# 单分支 dry → 执行 → 幂等
bash scripts/cleanup-merged-branches.sh <merged-branch>
bash scripts/cleanup-merged-branches.sh --yes <merged-branch>
bash scripts/cleanup-merged-branches.sh --yes <merged-branch>   # nothing to clean
```

harness（`scripts/acceptance-battery-v2.sh` / `-v3.sh`）是**本机历史记录**：入口 `cd`
为本机 worktree 绝对路径，且 fixture 消费真实已合残留（跑一遍即清掉），复跑需有同类
残留分支在册。
