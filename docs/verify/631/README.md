# #631 总管对话失败闭环——验证证据

隔离 live 栈（verify-pacman：server 8795 + vite 5277 + scratch PACMAN_HOME），真 daemon 在线，provider 指向恒 400 的 stub LLM（复刻用户 relay 的间歇 400 签名 `Model does not support this protocol.`）。驱动 = Playwright 真用户路径：/app → FAB 开 drawer → composer 输入 → Enter。

| 组 | 内容 | 关键断言 |
|---|---|---|
| `before/` | 修复前复现 | step failed（9s）后 UI 全静默：0 robot 行、0 toast、drawer 无任何失败词（`result.json` no-response-no-feedback）；daemon 失败签名与用户真实 `~/.pacman/daemon.log` 悬案逐字一致（`daemon-log-signature.txt`）；errorMessage 零落库零通知（`truth.json`） |
| `after-async/` | 修复后（异步回合失败） | toast 弹出（含原因原文）+ 线程内持久失败行 `.chief-error`（`result.json` failure-toast-appears / toast-carries-reason / failure-row-persists-in-thread）；API 失败行 `chief-err-<stepId>` = `{kind:"chief_turn_error"}`（`truth.json`） |
| `after-sync/` | 修复后（发送被拒，网络层断） | toast「发送失败，请重试。」+ 原因；draft 逐字保留不丢字（`result.json` reject-toast-appears / reject-draft-preserved） |

探针脚本（会话内产物，未入库）：`.claude/verify-shots/probe-chief-fail.mjs`（before/after 双模式）、`probe-chief-send-fail.mjs`（route 拦截注入网络失败）。
