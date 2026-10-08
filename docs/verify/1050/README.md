# #1050 claude 二进制事实源 · 实跑证据

复跑配方（隔离栈，不碰 8787/5173 上的活跃 dev 栈）：

```bash
cd <worktree 绝对路径>
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
  VERIFY_REPO_ROOT=$PWD node .claude/skills/verify-pacman/scripts/launch.mjs
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
  VERIFY_REPO_ROOT=$PWD node .claude/skills/verify-pacman/scripts/drive-1050-claude-bin.mjs
```

探针自起 daemon（独立 `PACMAN_HOME` scratch）并自回收；两条腿各用一台
scratch home，同一 machine 名 `probe-1050`（腿 B 覆盖腿 A 的上报，正是要的
单向性：后报的事实取代先报的）。

## 结果：13/13 PASS

腿 A（stub claude 前置进 PATH，`--version` 报 `9.9.9-probe`、`auth status` 报已登录）

- `A1` daemon.log：`[machine] claude binary: <path> (9.9.9-probe)`
- `A2` machine 行 `claudeCodeReport.bin = {path, version: "9.9.9-probe"}`
- `A3` machine 行 `claudeCodeReport.auth.state = "logged-in"`
- `A4` `GET /model-sources` 的 claude-code 段带 `bin`/`auth`（server 透传）
- `A5` providers 页细字行：`claude 9.9.9-probe · <path>`
- `A6` 页面 `data-auth="logged-in"`，无「未登录」角标

腿 B（同机，`PACMAN_CLAUDE_BIN` 指不存在的路径；`~/.claude/settings.json` 不动）

- `B1` daemon.log：`[machine] claude binary: not found on PATH`
- `B2` machine 行 `bin` 键在、值为 **null**（探过了没有）
- `B3` `GET /model-sources` 段同样 `bin: null`
- `B4` **页面回「未安装」**——这台机器此刻 `installed:true`（settings.json 在、五个模型槽照常解出）却仍然说未安装。这是本票要消的那类假绿：改动前它说「已安装在 DESKTOP-N9CSRE4」。
- `B5` 页面无细字行、不写「未知」

## 判读要点

- `bin` 的三态在 wire 上**不合并**：对象 = 探到了；`null` = 探过了没有；键缺席
  = 没探过（老 daemon）。页面据此三分：装了 / 未安装 / 退回「只看 installed」
  的旧行为。`B2`/`B3` 钉的是「探过了没有」不可退化成缺席——退回缺席就退回假绿。
- 页面判据优先级 = **二进制 > 配置文件**。配置文件在而二进制没了时说话的是
  二进制（`B4`）；二进制在而没写配置时说「已安装，未配置模型槽」（fixture
  `10-cc-noconfig` 的 e2e 钉住，补法句与「没装」不同）。
- 本探针真跑的 claude 是 **stub**（版本 9.9.9-probe 一眼可辨），所以证据里
  的版本与路径都是探针做的，不是本机真 claude 的读数。
- 杠 B 的模型槽来自本机真 `~/.claude/settings.json`（隔离栈的 daemon 读的是
  真正的 home），故 `model-sources-b.json` 里能看到真实槽位——这不是泄漏，
  与 `docs/verify/707` 同面。

## 文件

| 文件 | 内容 |
|---|---|
| `01-installed-logged-in.png` | 腿 A header 卡截图（细字行 + 版本 + 路径） |
| `02-binary-missing.png` | 腿 B header 卡截图（未安装 + 指引） |
| `result.json` | 13 条 check 的逐条结果与 detail |
| `daemon-a.log` / `daemon-b.log` | 两条腿的 daemon 输出（探测行在此） |
| `model-sources-a.json` / `model-sources-b.json` | API 封套原文（bin/auth 二态对照） |
| `page-a.txt` / `page-b.txt` | header 卡 innerText 原文 |
