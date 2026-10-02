# relay-probes — 2026-10-02 直连实测（http://112.80.47.186:8783，Bearer）

问题：relay 通道池对 pi 默认请求形（`max_completion_tokens` + `store:false` +
`stream_options`）部分通道返回 400 `{"message":"Model does not
support this protocol.","type":"server_error"}`。裸 HTTP 复刻 pi 形态实测。

## 形态×模型矩阵（当晚 3 个时间窗）

| 探针（同模型同 token，仅字段形态不同） | 结果 |
|---|---|
| `deepseek-v4.1-flash` + 旧式形（`max_tokens`，无 store），非流式 | 1/1 PASS（回 "ok"） |
| `deepseek-v4.1-flash` + pi 现代形（mct + store + stream_options + stream + tools + developer/system 双角色各 3 次） | 12/12 PASS，0 个 400 |
| `qwen3.8-max` + pi 现代形（窗口 A，n=8） | **4/8 = 50% 命中协议 400** |
| `qwen3.8-max` + 旧式形（`max_tokens`，无 store，同窗口 n=8） | **1/8 = 12.5% 命中** |
| `qwen3.8-max` + 现代形（窗口 B，n=12 连发） | 6/12 = 50% 命中（PASS/400 交替） |
| `qwen3.8-max` + 现代形（窗口 C，约 40 分钟后，n=6） | 6/6 PASS——坏通道窗口关闭 |
| `deepseek-v4-flash` / `glm-5.3` + 现代形（各 3 次） | PASS |
| 无鉴权请求 | `API_KEY_REQUIRED`（网关存活与鉴权面正常） |

## 结论（三条）

1. **形态触发坐实**：同一时间窗内 qwen 通道现代形 50% vs 旧式形 12.5%——
   `max_completion_tokens`+`store` 把失败率抬升 ~37 个百分点；旧式形
   （= 本票 compat 旋钮产物）把触发面压回基线。
2. **残余 ~13% 与形态无关**：旧式形仍 12.5% 命中——通道池里存在「转换
   坏」的连接（任何形态都拒）。该面由 pi 内建重试吸收（错误体
   `"type":"server_error"` 恰好命中 pi 的 retryable 词表，3 次预算 + 指数
   退避；mea 9999 shim 遥测同源：229 调用 31 次一次重试即过、0 次重试耗尽）。
3. **坏通道窗口随时间开合**：同一探针晚 10 点 50% 命中、10:40 全过——
   mea daemon.log（2026-10-01）里 qwen3.8-max 步 10 连 400 至
   stream timeout 的死亡螺旋 = 撞上窗口期的同类；窗口期形态触发是确定
   性的（pi 同形重试恒败），这正是步内回落要解决的问题。

生产现场（mea `~/.pacman/daemon.log`，2026-10-01，30 处命中）同款签名：

    [step] error: 400: {"message":"Model does not support this protocol.","type":"server_error"} (retryable=false)
    [step] auto_retry_start attempt=1
    （×10，同形重试全败）
    [step] step failed: stream timeout (first=300000ms idle=480000ms)

涉及模型：`relay-186/qwen3.8-max`（死亡螺旋现场）、`relay-186/deepseek-v4-flash`、
`relay-186/kimi-k3`（各撞 400 行）。
