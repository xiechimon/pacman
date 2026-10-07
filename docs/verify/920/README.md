# #920 验证证据索引 — 技能分发「清单 + 按需拉」

探针 = `.claude/skills/verify-pacman/scripts/drive-920-skills-manifest.mjs`（纯 HTTP + fs + SQLite 只读，无浏览器面）。
运行日 2026-10-07；新栈 = 本分支 worktree（server 8791 / web 5273，scratch `PACMAN_HOME`，fixture 技能库由探针自动落盘）；before 基线栈 = `origin/main` 一次性 worktree（server 8793 / web 5275，独立 run dir）；daemon = 本分支代码 `tsx src/cli.ts start --foreground`，各自独立 scratch home（`/tmp/pacman-920-daemon-home-{c1,d1}`）；stub LLM = `stub-llm-verify.mjs`（`STUB_PORT=8919 STUB_DELAY_MS=500`）。

**46/46 checks 全绿**，五组证据：

| 目录 | 相位 | checks | 覆盖的票面验收 seam |
|---|---|---|---|
| `wire-new/` | `--phase=wire --expect=new` | 14/14 | 超限文件不再让整包失败（727,976B 单文件 + 2.98MB 库照常出清单）；清单三元组 = 盘上真值（12/12 sha256/size 对拍）；file 端点字节级校验 12/12 + 二进制诚实；负面 8 面 404（他机凭证/未知步/白名单外/逃逸形） |
| `daemon-success/` | `--phase=daemon-success` | 11/11 | 技能文件落盘且可读、数量与清单一致（12 文件逐字节 = server 侧真值；`[skills] loaded: 4 skills from <views dir>` = 运行时 catalog 真消费）；blobs 内容寻址去重（唯一内容 8 条） |
| `daemon-incremental/` | `--phase=daemon-incremental` | 8/8 | 增量：改一个文件后第二步 `fetched 1 file(s) / 1060 byte(s), reused 11`——字节数差异可断言（改前 1024B → 改后 1060B，只传新的那份） |
| `wire-old-before/` | `--phase=wire --expect=old` | 5/5 | before 基线：同库同请求打 `origin/main` 旧整包端点 → 400 `skill file too large: assets/template.html is 727976 bytes (limit 512000)`——#920 根因指纹复现 |
| `daemon-fail-old-server/` | `--phase=daemon-fail` | 8/8 | 端点 4xx 显式报错可观测，不是静默空清单：新 daemon × 旧 server → 步按 failed 收尾，`build.errorMessage = team skills distribution failed: machine api 400: …`（SQLite 行在库 = UI 可观测），daemon.log `team-skills-failed` + `[step] failed:` 直报行，零物化零会话 |

「远端机器」判读的替代口径：daemon 与 server 只经 HTTP wire 通信、各持独立 home——隔离 daemon home 与真远端机走的是同一条代码路径（enroll/claim/skills/done），本机不持技能副本即等价「换一台机器拿到空技能面」的场景。

## 复跑配方

```sh
# 新栈三相位
node .claude/skills/verify-pacman/scripts/launch.mjs            # VERIFY_REPO_ROOT=<worktree>
node .claude/skills/verify-pacman/scripts/drive-920-skills-manifest.mjs --phase=wire --expect=new
STUB_PORT=8919 STUB_DELAY_MS=500 node .claude/skills/verify-pacman/scripts/stub-llm-verify.mjs &   # 后台
# seed：GET /api/teams 取 teamId；POST /api/teams/{t}/api-keys 取 plaintext（curl 一律 --noproxy '*'）
cd apps/daemon && env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY NO_PROXY='*' \
  PACMAN_HOME=/tmp/pacman-920-daemon-home-<新后缀> pnpm exec tsx src/cli.ts start --foreground \
  --server http://127.0.0.1:8791 --api-key <plaintext> --team <teamId> --name verify-920 &        # 后台
DAEMON_HOME=<同上> node .../drive-920-skills-manifest.mjs --phase=daemon-success
DAEMON_HOME=<同上> node .../drive-920-skills-manifest.mjs --phase=daemon-incremental

# before 基线两相位（origin/main 一次性 worktree + 独立端口/run dir）
git worktree add --detach /tmp/pacman-before-920 origin/main && (cd /tmp/pacman-before-920 && corepack pnpm install)
VERIFY_REPO_ROOT=/tmp/pacman-before-920 VERIFY_RUN_DIR=/tmp/pacman-before-920-run VERIFY_PORT=8793 VERIFY_WEB_PORT=5275 \
  node /tmp/pacman-before-920/.claude/skills/verify-pacman/scripts/launch.mjs
SERVER=http://127.0.0.1:8793 VERIFY_RUN_DIR=/tmp/pacman-before-920-run \
  node .../drive-920-skills-manifest.mjs --phase=wire --expect=old
# 旧 server 上另 seed 一把 api-key，起第二个 daemon home 指 --server 8793，然后：
SERVER=http://127.0.0.1:8793 VERIFY_RUN_DIR=/tmp/pacman-before-920-run DAEMON_HOME=<d1 home> \
  node .../drive-920-skills-manifest.mjs --phase=daemon-fail
```

## 结果判读（复跑时会撞的三个点）

- **步终态 = failed「构建零改动」是预期**：stub 会话零写类工具行 → `sawChangeTool=false` → 产物闸（`stepArtifactGate`）判 failed。该闸在 skills 缝**之后**，到达它即证明分发/物化/会话全链未阻断；探针按 `sessionRanToCompletion` 接受此形态。
- **首拉 `fetched=8 / reused=4` 而非 12/0**：fixture 的 heavy/p0..p4 五个文件同内容 → 同 sha256 → blob 内容寻址首拉即去重。期望值按 fixture 唯一 sha 数动态算。
- **`step` 表没有 errorMessage 列**：步失败根因落 `build.errorMessage`（`completeStep` 落位）；SQL 判据要读 build 行。
