# verify 925（+#927）· pi 会话运行面与信任面 live 取证

票面 seam（#925 trust/telemetry/settings、#927 cost/cache）在 daemon 日志、wire 请求形与 DB 行上，无 UI 面——probe 走 #920 同族「纯 HTTP + fs + SQLite 只读」形态，自 spawn stub LLM + 真 daemon 并自回收。

- Probe：`.claude/skills/verify-pacman/scripts/drive-925-pi-policy.mjs`
- 结果：**12/12 PASS**（`live/result.json` 的 checks 逐条对齐）
- 栈坐标：verify 栈 server `127.0.0.1:8791` + scratch `PACMAN_HOME`（launch.mjs 全新库）；daemon home `/tmp/pacman-925-daemon-home`（每跑清空）；stub LLM ephemeral 端口
- 运行日：2026-10-08（分支 `hp/pacman/t-0221-925-927-pi`）

## 复跑配方

```sh
# 端口占用先查（8791/5273 被别的 lane 占就顺延，别杀）
lsof -iTCP:8791 -sTCP:LISTEN
# 1) 起隔离栈（worktree 车道带 VERIFY_REPO_ROOT）
VERIFY_REPO_ROOT=<worktree> node <worktree>/.claude/skills/verify-pacman/scripts/launch.mjs
# 2) 跑 probe（proxy 全 unset + NO_PROXY='*'——回环 API 要 --noproxy 方向）
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' no_proxy='*' \
  VERIFY_REPO_ROOT=<worktree> node <worktree>/.claude/skills/verify-pacman/scripts/drive-925-pi-policy.mjs
# 3) 回收
VERIFY_REPO_ROOT=<worktree> node <worktree>/.claude/skills/verify-pacman/scripts/cleanup.mjs
```

重跑注意：probe 的 provider seed 撞 409（`stub-gw` 已存在）会自动 PATCH 刷新 baseUrl——stub 端口是 ephemeral 的，不刷新就是首跑实测的「Connection error.」假红。

## 判读（checks ↔ 票面 seam ↔ 证据文件）

| check | 票面 seam | 实物 |
|---|---|---|
| plan 步真跑完（status=done） | 全链真实性前提 | `result.json` detail（step 行 id/kind/status） |
| 策略宣告行五面齐 | #925 telemetry/settings「关到什么程度」可观测 | `daemon-log-policy.txt` 的 `[machine] pi policy: trust=deny telemetry=off version-check=off cache-retention=long settings=in-memory …` |
| `[trust] denied:` 点名 `.pi/SYSTEM.md` | #925 trust「被拒时有可观测记录，不是静默跳过」 | `daemon-log-policy.txt` |
| 劫持 marker 零进入 LLM 输入面 | #925 trust deny 行为与决定一致 | `stub-request-first.json`（全部请求体由 probe 审过；首请求全文归档） |
| 简报通道零回归（任务文本在请求面） | deny 不伤 AGENTS.md 简报 | 同上 |
| `prompt_cache_retention:"24h"` 上送 | #927 缓存保留「显式设置且相符」（`PACMAN_PI_CACHE_RETENTION=long` → pi openai-completions 适配器） | `stub-request-first.json` 顶层字段 |
| per-message usage 行 = 请求数、逐条 cost=2010 | #927「追溯到具体的 per-message usage」的运行时对账面 | `daemon-log-usage.txt`（`[step] message usage: stub-gw/stub-model … cost=2010` 每消息一行） |
| usage API 单行 + cost 五分项 = worked example | #927 成本「落库/事件流可见、追溯 per-message」 | `usage-api.json`；算据：stub 每响应 usage {prompt:12, completion:980, cached:100} → pi 映射 input 0/output 980/cacheRead 100；声明价 {input:1e6, output:2e6, cacheRead:5e5} USD/1M → pi calculateCost 每消息 $2010 × 2 消息 = **$4020**（costOutput 3920 + costCacheRead 100） |
| 四维回归逐值一致 | #927「既有口径零变化」 | `usage-api.json`（input 0 / output 1960 / cacheRead 200 / cacheWrite 0 = 2 × per-message） |
| SQLite 行 = API 同值 | 落库真值（real 列） | `token-usage-row.json` |

CI 侧同 seam 的常驻钉：`apps/daemon/test/pi-session-policy.test.ts`（策略声明面 11 例）、`apps/daemon/test/map-pi-event.test.ts`（cost 映射 + 无 cost 回归）、`apps/daemon/test/pi-config-effect.test.ts`（价格声明位物化）、`integration/test/pi-session-policy.test.ts`（六失败方式全链）。
