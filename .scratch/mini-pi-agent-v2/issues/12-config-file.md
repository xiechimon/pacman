# 12: ~/.mini-pi/config.json 配置文件与凭据解析

**What to build:** 单文件配置 `~/.mini-pi/config.json` 承载 provider 与凭据；首次启动交互式初始化；凭据三层优先级 CLI > config > env。设计决策见 `docs/adr/0001-single-file-config.md`，术语见 `CONTEXT.md`。

**Blocked by:** 05 (TUI wireup)。

**Status:** done

## Acceptance criteria

- [x] 首次启动无 config 时交互式提示 apiKey（必填）+ baseUrl（可选），写入 `~/.mini-pi/config.json`（0600）
- [x] config 已存在时跳过初始化直接启动
- [x] 凭据优先级：CLI `--api-key` > config 条目 > 环境变量 `<PROVIDER>_API_KEY`
- [x] config 条目中 `apiKey` 支持 `$VAR` / `${VAR}` 环境插值与字面量；引用的变量未设置时报错（fail fast）
- [x] 已存储 config 条目独占 provider，不静默回退环境变量
- [x] provider 选择：CLI `--provider` > `defaultProvider` > providers 第一个 key
- [x] 模型选择：CLI `--model` > provider `defaultModel` > 内置默认 `claude-sonnet-5`
- [x] `baseUrl` 传给 Anthropic SDK（代理/网关场景）
- [x] 非 TTY（CI）无 config 时跳过交互，走环境变量兜底；全无凭据时报 ConfigError 退出码 1
- [x] config.json 非法 JSON / 缺 providers / provider 条目非对象 → ConfigError 友好报错
- [x] `--help` 打印用法
