# #1048 证据（令牌门页补「令牌从哪来」指引）

> 纯信息缺口票：只加文案指引，鉴权逻辑零改动。before = `763c21f2`（origin/main，
> 无指引）；after = 本分支（`token-gate.tsx` 加 `.token-gate-help` 段 + `en.ts`
> 对应词条）。栈纪律 = verify-pacman SKILL.md 同款隔离：独立 PACMAN_HOME
> scratch（`/tmp/t0250/home-*`）+ OS 空闲端口，绝不碰 8787/5173 用户栈。

## 0. 结论速览

| 验收面 | 结果 | 产物 |
|---|---|---|
| 改前：门页只说「已开启鉴权」，不说令牌从哪来 | 复现（zh/en 双面均无来源信息） | `before-gate-zh.png` / `before-gate-en.png` |
| 改后：门页含来源指引（变量名经 BRAND 槽插值 = `PACMAN_TOKEN`） | zh/en 双面呈现 | `after-gate-zh.png` / `after-gate-en.png` |
| 指引可执行：照文案从 env 文件读出变量值 → 输入 → 过闸进看板 | 走通 | `after-passed-zh.png` + §1 实录 |
| 未设 `PACMAN_TOKEN`：闸不注册、层不出现、API 200 零凭据 | 与改前一致 | `after-notoken-no-gate.png` + `open-200.txt` |
| 鉴权开时 API 401 形状不变 | `{"error":"Unauthorized"}` | `gate-401.json` |
| 文案不含示例令牌值 | e2e 钉住（变量名后禁 `=` 右值） | `token-gate.spec.ts` 失败方式 9 |
| 回归 | token-gate spec 6/6；web e2e 全量 855/855；web vitest 469/469；lint / typecheck / spec:parse 全绿 | — |

## 1. 实测实录（指引与真实机制对齐，票 AC2）

起栈方式即文案所指的 systemd `EnvironmentFile` 机制：`boot.sh token` 把
`/tmp/t0250/token.env`（一行 `PACMAN_TOKEN=<一次性随机值>`，值不入档）source
进服务端进程环境——systemd 的 `EnvironmentFile=` 做的正是同一件事（把 KEY=VALUE
注入单元进程环境），server 在 `config.ts` 经 `envStr(ENV_VARS.token)` 于进程
启动时读一次。

```console
$ bash docs/verify/1048/boot.sh token
mode=token port=61495 code=401 expect=401 pid=85756

$ node docs/verify/1048/probe.mjs after --walkthrough /tmp/t0250/token.env
[walkthrough] read PACMAN_TOKEN from /tmp/t0250/token.env
[walkthrough] gate passed with the value read from the env file
```

walkthrough 语义 = 严格按文案走一遍：门页说「去启动它的环境里找这个变量」→
到起栈用的 env 文件读出 `PACMAN_TOKEN` 的值 → 填进门页 → 门页关闭、看板呈现
（`after-passed-zh.png`）。找到即有效，证明文案指向的落点就是真值所在。

```console
$ bash docs/verify/1048/boot.sh notoken
mode=notoken port=52857 code=200 expect=200 pid=44114

$ node docs/verify/1048/probe-notoken.mjs
api /api/teams status (expect 200, auth off): 200
token-gate count (expect 0): 0
```

## 2. 复跑配方

```sh
cd apps/web && pnpm exec vite build --mode fixture   # dist = 托管静态面
bash docs/verify/1048/boot.sh token                  # 鉴权开栈（401）
bash docs/verify/1048/boot.sh notoken                # 鉴权关栈（200）
node docs/verify/1048/probe.mjs after --walkthrough /tmp/t0250/token.env
node docs/verify/1048/probe-notoken.mjs
# 收尾：kill $(cat /tmp/t0250/server-token.pid) $(cat /tmp/t0250/server-notoken.pid)
```

探针从仓库根目录运行；截图路径 `docs/verify/1048/` 相对根目录解析。

## 3. 文件清单

| 文件 | 内容 |
|---|---|
| `before-gate-zh.png` / `before-gate-en.png` | 改前门页（763c21f2）：无任何来源指引 |
| `after-gate-zh.png` / `after-gate-en.png` | 改后门页：`.token-gate-help` 指引段，双面变量名 `PACMAN_TOKEN` |
| `after-passed-zh.png` | walkthrough 终态：按文案取到值后过闸进看板 |
| `after-notoken-no-gate.png` | 未设变量：直达看板，门页不出现 |
| `gate-401.json` / `open-200.txt` | 两栈 API 首访形状（401 `{"error":"Unauthorized"}` / 200） |
| `boot.sh` / `probe.mjs` / `probe-notoken.mjs` | 可复跑脚本（本目录产物即由它们生成） |
