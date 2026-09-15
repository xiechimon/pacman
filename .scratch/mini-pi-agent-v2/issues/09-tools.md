# 03: @mini-pi/agent — 4 个内核工具

**What to build:** read、write、edit、bash 四个工具，每个有 JSON Schema 参数定义和 `execute(callId, args)` 实现，可独立测试。

**Blocked by:** 01 (needs ToolDef type from @mini-pi/ai).

**Status:** done

## Acceptance criteria

- [x] **read**：参数 `path`（必填）+ `offset`/`limit`（可选）。返回文件内容，自动 truncate 到 2000 行/50KB。文件不存在时返回错误结果。
- [x] **write**：参数 `path` + `content`（均必填）。覆盖式写入，父目录自动创建。
- [x] **edit**：参数 `path` + `old_string` + `new_string`（均必填）。精确匹配 `old_string` 必须唯一，否则返回错误提示。匹配不到时返回错误。
- [x] **bash**：参数 `command` + `description`（均必填）。执行 shell 命令，返回 `{ stdout, stderr, exitCode }`。继承用户 shell 权限。
- [x] 每个工具 `ToolDef` 含 `name`、`description`、`parameters`（JSON Schema）、`execute` 函数
- [x] 工具执行错误通过 `ToolResult.isError: true` 返回，不抛异常
- [x] 工作区根目录通过构造函数或工厂函数注入（默认 `process.cwd()`）
- [x] 每个工具可独立 import 并调用，不依赖 agent 循环