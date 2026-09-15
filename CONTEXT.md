# CONTEXT · pacman 术语表

- **pacman**：本仓的 agent 产品名。fork 自 craft-agents-oss v0.13.3 的桌面 agent。productName、包作用域（`@pacman/*`）、配置目录（`~/.pacman`）、URL scheme（`pacman://`）、env 前缀（`PACMAN_`）都以它为准。
- **上游 / upstream**：craft-agents-oss（Apache-2.0）。其全量 git 历史保存在 `vendor/upstream` 只读分支，供捡修复用。
- **换皮（rebrand）**：把上游的身份引用替换为 pacman。本项目采用**深换皮**：用户可见面 + 内部包名、协议字段、env 前缀全换。
- **裁剪（cut list）**：删除/断开上游对 Craft 官方服务的绑定（Sentry、feedback 工具、pages 发布等），清单见 `.scratch/craft-fork/issues/01-craft-service-bindings.md`。
- **施工票**：spec 落地时的最小执行单元，每张带完成条件。
