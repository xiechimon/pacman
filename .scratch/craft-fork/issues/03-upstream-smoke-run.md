---
labels: [wayfinder:task]
status: closed
owner: user
blockedBy: []
---

# 03 · 原仓本地跑通验证

## Question

不需要决策，但需要事实：在本机把上游原仓跑起来，验证「fork 后能跑」这个全项目前提。

1. 安装 bun（brew 或官方脚本）
2. 克隆上游 v0.13.3 到工作目录（或复用 `/tmp/craft-agents-oss-survey`）
3. 按 ticket 02 的命令序列装依赖、起 Electron dev 模式
4. 记录：bun 版本、跑通命令、每个卡点与解法、首屏截图

## Answer 需记录

bun 安装方式与版本、实际可用的启动命令、踩坑清单——spec 的「环境前提」节直接使用。

## Answer

**2026-09-15 实跑通过，Electron dev 窗口启动成功。** 环境：macOS 15.7.9 (Apple Silicon)、bun 1.4.2（brew）、node v24（fnm）。

实测可用命令序列：

1. `brew install oven-sh/bun/bun`（bun 1.4.2）
2. `git clone https://github.com/craft-ai-agents/craft-agents-oss ~/Code/AgentProjects/craft-agents-oss && git checkout v0.13.3`
3. `bun install`（postinstall 需放行，Electron 二进制在此下载）
4. `bun run electron:start`（首次构建 2–4 分钟出窗口）

## 踩坑实录

- **坑 1：~/.bun 悬空符号链接导致 bun install 死循环**。`~/.bun` 曾是指向未挂载外置盘（/Volumes/SanDisk/...）的 symlink，bun 1.4.2 在无法创建缓存目录时原地 mkdir 重试（99% CPU、零输出、零网络），且在任何项目上都复现。解法：删 symlink 重建本地目录。spec「环境前提」需写明：bun 缓存目录必须在已挂载的本机磁盘上。
- `--ignore-scripts` 装的依赖缺 Electron 二进制，需 `bun rebuild` 补跑 postinstall。
