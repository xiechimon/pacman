# 环境固化（可复现安装）

从干净 macOS 机器到 `bun install` 成功、Electron 窗口启动的完整前提与已知坑。macOS 15.7.9 (Apple Silicon) 实跑验证：2026-09-15 首跑，2026-09-16 干净克隆全链路复现。

## 工具链

| 项 | 要求 | 说明 |
| --- | --- | --- |
| bun | brew 安装，1.3.x 起均可；实测 1.4.2 通过 | `brew install oven-sh/bun/bun`。CI 钉 `1.3.10`（`.github/workflows/validate.yml`），打包脚本钉 `bun-v1.3.9`（`apps/electron/scripts/build-dmg.sh`） |
| Node.js | ≥18 在 PATH 上 | 构建脚本用 `node --check` 校验产物，不由 bun 代跑 |
| 磁盘 | `~/.bun` 必须在已挂载的本机磁盘上 | 见下方坑 1，装前必查 |

## 标准序列

```bash
git clone https://github.com/xiechimon/pacman.git
cd pacman
bun install            # 前提：坑 1 已排除；下载慢见坑 3；API 限流网络用坑 4 ① 的命令
bun run electron:start # 首次构建 2–4 分钟，出 Electron 窗口
```

开发回路（Vite HMR，端口 5173）：`bun run electron:dev`。首次运行会联网下载 `uv` 到 `apps/electron/resources/bin/<platform>-<arch>/`，离线机器先手动跑一次。

## 四个坑（按踩中概率排序）

### 坑 1 · `~/.bun` 悬空 symlink → `bun install` 死循环

**症状**：`bun install` 无任何输出、不联网、99% CPU 原地转圈，任何项目都复现。

**成因**：`~/.bun` 曾是指向未挂载外置盘的 symlink（如 `/Volumes/...`），bun 1.4.2 在无法创建缓存目录时陷入 mkdir 重试循环，不报错。

**装前必查**：

```bash
readlink ~/.bun        # 有输出 = symlink，看指向是否已挂载
ls -ld ~/.bun          # 真实目录才是正常态
# 命中悬空 symlink 时：
rm ~/.bun && mkdir -p ~/.bun
```

### 坑 2 · postinstall 被跳过 → Electron 二进制 / rg 缺失

**成因**：`package.json` 的 `trustedDependencies` 白名单（`electron`、`@vscode/ripgrep`、`electron-winstaller`、`esbuild`、`koffi`、`protobufjs`、`sharp`）决定哪些包能跑 lifecycle script：electron 的 postinstall 负责下载运行时，`@vscode/ripgrep` 负责落地 `bin/rg`。任何 `--ignore-scripts`、第三方安装器或镜像过滤都会把这两个产物装丢，运行时报错离装依赖已经很远，难归因。

**规则**：

- 不要 `bun install --ignore-scripts`。
- 已经用过的补救：`bun rebuild`（补跑 postinstall）。
- 不要覆盖 linker：`bunfig.toml` 钉死 `linker = "hoisted"`，isolated 会让 Vite/esbuild 找不到 i18next、@tiptap/*、pdfjs-dist 等传递依赖。

### 坑 3 · Electron 二进制下载慢

**成因**：electron postinstall 从 GitHub Releases 拉 ~100MB 二进制，国内网络间歇性慢或挂起。

**兜底**：

```bash
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
bun install
```

### 坑 4 · `@vscode/ripgrep` postinstall 被 GitHub API 限流 403（且有静默重试陷阱）

**症状**：`bun install` 报 `Downloading ripgrep failed after multiple retries: Error: Request failed: 403`。其 postinstall 先请求 `api.github.com`（匿名限额 60 次/小时/IP，共享出口 IP 的机器常年打满）。

**陷阱**：失败时它已经 `mkdir` 了空的 `bin/` 目录；而 postinstall 的跳过条件是 **bin/ 目录存在**（不检查 rg 文件）。所以直接重跑 `bun install` 会 exit 0 但 rg 缺失——错误被推迟到运行时才暴露。

**修复（二选一，① 已实测）**：

```bash
# ① 用 GitHub token 提高限额（gh CLI 登录过即可）
rm -rf node_modules/@vscode/ripgrep
GITHUB_TOKEN=*** auth token) bun install

# ② 本机已有可用 rg 时直接软链（先 brew install ripgrep）
mkdir -p node_modules/@vscode/ripgrep/bin
ln -s /opt/homebrew/bin/rg node_modules/@vscode/ripgrep/bin/rg
```

**自检（任何安装方式做完都要跑）**：

```bash
node_modules/@vscode/ripgrep/bin/rg --version   # 有版本号输出才算装成
```

## 干净环境验收清单

按本文档在从未装过本项目的机器上执行，以下全部成立即通过：

1. `readlink ~/.bun` 无输出（或指向已挂载盘）且 `ls ~/.bun` 正常
2. `bun install` 退出码 0，无 99% CPU 空转（IP 被限流时按坑 ① 用 `GITHUB_TOKEN` 跑）
3. `ls node_modules/electron/dist/Electron.app` 存在（postinstall 真跑了）
4. `node_modules/@vscode/ripgrep/bin/rg --version` 有输出（exit 0 ≠ rg 在，见坑 4）
5. `bun run electron:start` 在 4 分钟内弹出窗口
