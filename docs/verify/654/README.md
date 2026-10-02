# docs/verify/654 — relay 协议 400 自适配（issue #654）

验证日期 2026-10-02。栈 = verify-pacman skill 隔离栈（branch：
`VERIFY_PORT=8793/VERIFY_WEB_PORT=5275` + scratch PACMAN_HOME；before：
main 检出一次性 worktree `8794/5276`）。relay = 用户自有网关
`http://112.80.47.186:8783` 直连（不经 mea 9999 shim——shim 会改写请求形，
mask 掉本票要验的触发面）。

## after/（branch，#654 改动生效）

- `models.json` — daemon 物化产物：provider 条目带
  `compat: {maxTokensField: "max_tokens", supportsStore: false}`
  （record compat → token 下发 → daemon 物化全链路）。
- `daemon-branch-deepseek.log` — 真步全链路：`claim step` →
  `using model relay-direct/deepseek-v4.1-flash` → `new session` →
  `pushed pacman/conv-…` → `finished (0 running)`。**零 400 行**。
- server DB 真值（收栈前查询）：step `{kind: build, status: done}`；
  message 57 行；toolcall 24 件（read×10、write×10、bash×3、
  set_task_meta×1）；todo phase → `review`；工作区 a.txt–j.txt 10 文件
  各 27B（内容 `file <字母> created by deepseek`）。
- **验收：≥10 轮含工具调用的 agent 步零 400（24 件工具调用，0 个 400）。**

## before/（origin/main @18f906b0，无 compat 物化面）

- `models.json` — main 物化产物：provider 条目**无 compat 键**——
  pi 端点探测默认生效（现代形 `max_completion_tokens` + `store:false`）。
  与 after/ 同一 provider 形状的逐字段 diff 就是本票的物化面差异。
- `daemon-main-qwen.log` — main 代码 + qwen3.8-max + relay 直连两轮
  真步。当晚该时段 relay 坏通道窗口恰好关闭（见 relay-probes 窗口 C），
  两步均干净完成——诚实记录：live 差分当天不可按需复现，差分机制由
  pi-protocol-fallback.test.ts 15 测钉死（签名/回落/物化/runner 回落闸），
  触发面证据见 relay-probes/（同晚窗口 A/B 的 50% 实测 + mea 生产日志）。

## relay-probes/

- `curl-probe-transcript.md` — 形态×模型×时间窗矩阵（qwen 现代形 50% vs
  旧式形 12.5% vs deepseek 0%；窗口开合；mea shim 遥测交叉引用）。

## 测试面

- `apps/daemon/test/pi-protocol-fallback.test.ts` — 15 测全绿
  （protocolCompatFlip 签名 4、adaptProviderCompat 回落学习 3、
  materializeProvider 物化 3、runner 步内回落闸 5）。
- daemon 全套 29 文件 259 测、server 52 文件 585 测、shared 7 文件 79 测
  （snapshot 2 块更新 = compat 扩展的预期投影，逐块核过 diff）。
- 三闸：lint / format / typecheck 全绿。

## 已知残余（票面记录，非本票缺口）

- relay 通道池的「转换坏」连接（任何形态 ~13%）由 pi 内建重试吸收
  （3 次预算）；坏窗口全开时同连接连续失败仍可能耗尽预算——步内回落
  给一次翻旋钮重试，再败按现状失败。根治 = 网关侧修通道池（用户资产，
  需网关入口，另行处理）。
- 学习态进程内（daemon 重启清零，首个撞错步付一次回落学费）；持久化
  到 provider record 需 machine→server 写面，未在本票白名单内。
