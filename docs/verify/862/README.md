# docs/verify/862 — T1 跨机续跑最小闭环 live 证据

## 跑法

scratch 栈（server 8796 + web 5278，全新库）+ 真 daemon ×2（独立 PACMAN_HOME、
独立机器身份 daemon-a / daemon-b）+ stub LLM（门控 30s/轮，OpenAI SSE 兼容）。
探针脚本（未进仓，lane 本地）：`/tmp/pacman-t1-862/drive-reclaim.mjs`。

链路（build `01a107d2-b5ab-7d26-9d67-e97fa370ae28`，本目录 `result.json` 有完整 check 表）：

1. daemon-a 认领 build 步（new session，无历史）。
2. 步运行中 `kill -9` 整进程组 daemon-a（死亡证明：server 置 machine offline）。
3. 失联 120s 心跳墙 + 15s tick → sweep 释放回 pending（machineId 清空，wake 唤醒）。
4. 历史会话行（sqlite 直插 done 步 `sess-seed-1`，模拟“上一轮在 A 上跑完”）使
   daemon-b 的认领载荷为 `continue sess-seed-1`。
5. daemon-b 认领 → `SessionNotResumable` → 回退新会话 + transcript 显式 system 注记
   （`原会话不可复用，已用新会话重跑（上下文可能不完整）`）。
6. 步收尾上报（transcript 终稿含注记行）。

## 文件

- `result.json` — checks 逐条（8 项：7 通过 + 1 符合预期的闸失败，见下）。
- `steps.json` — step 行时间线（claimed by A → pending → claimed/done by B）。
- `transcript.json` — 会话终稿（含 system 注记行）。
- `daemon-a-tail.log` / `daemon-b-tail.log` — 两机日志尾（含 `falling back to new session`）。
- `probe.log` — 探针全程输出。
- `real-model-gap-deepseek.log` / `real-model-gap-glm.log` — 真模型两轮空流失败的
  探针输出（起步即失败，步未被认领超过数秒；daemon 侧空流原文见下）。

## 已知缺口（归 T6 / 后续）

- stub agent 不产生文件改动，build 步终态为 `构建零改动` 产物闸失败（`build.errorMessage`
  可查）。闸行为本身正确（无改动的步不应进 review）；跨机续跑的“认领→执行→上报”
  整链已走通，任务语义成功待真模型复验。
- 真模型（relay deepseek-v4.1-flash / glm-5.3，经 pi `openai-completions`）在 scratch
  上起步即 `Stream ended without finish_reason` 空流失败两轮。lane 手中只有 Claude
  订阅 token，直调 relay `/v1/chat/completions` 401——无可用 relay key 继续排查。
  按 #862 票面约定，现象贴票，修法留给 T6（跨机凭据预检）。
- mea 物理机层未跑：同无可用模型凭证（mea 现有 daemon 用 mea server 库里的钥，
  lane 不借用用户钥）+ claim 通道兼容已有单测覆盖 + 多机分布已有线上部署为证。
