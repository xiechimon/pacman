# plan — docs: ops-db-backup 环境前置与排障章节

## Context

- 任务边界：只改 `docs/ops-db-backup.md` 一个文件——在「## 备份」之前插一节「## 环境前置」，文末补一节「## 排障」；commit message 用英文；不动其他任何文件；完成后照常发 PR。
- 页面背景：该页是 #1151（已 CLOSED，segment 1 = #1161、segment 2 = #1167）的 server DB 备份/恢复正本；脚本 `scripts/ops/backup-server-db.sh` 已落地并由 mea 上的 systemd user timer 每小时实跑。
- 事实核对（已读脚本原文）：`sqlite3` 检查发生在跑脚本那台机（`command -v sqlite3` 缺失即 exit 1，有意设计）；远端推送走 `ssh -o BatchMode=yes` + `scp`（禁交互输密码，必须公钥）；文档示例 `dmit:~/pacman-db-backups` 里的 `dmit` 就是 ssh config Host 别名。
- 工作区现状：AGENTS.md 有 runtime 注入的未提交改动（非本任务所改），plan.md 为工作区交接物——两者都不进 commit。

## Changes

- `docs/ops-db-backup.md`（本任务唯一改动的文件）：
  - 「## 环境前置」（插在「## 备份」之前）三条：①跑脚本的机器必须有 sqlite3，缺失报错退出是有意设计，Debian/Ubuntu 用 `sudo apt-get install -y sqlite3` 装；②远端备份目标机要 ssh 互通（scp 推送、BatchMode 禁密码，须公钥），建议 ssh config 配 Host 别名，示例即 `dmit`；③自检 = 手动跑一次「备份」节命令，本地与远端目录各多一份即通。
  - 「## 排障」（文末新节）：先 `systemctl --user status pacman-db-backup.service` 看最近一次输出，再 `journalctl --user -u pacman-db-backup.service` 看历史；补一句「没触发」先查 `list-timers`（引「调度」节），环境缺口对照「环境前置」补。
- commit：`git add docs/ops-db-backup.md` 显式路径（绝不带 AGENTS.md）；英文 message，`docs(1151): ...` 格式，不带任何关票关键字（#1151 已关、无新开票）。
- PR：走 pr-pacman 六节契约（What/Verified/Upstream/Risk/Acceptance/Issues），body 英文写临时文件，本地 `pr-evidence-gate.py` 过闸后 `gh pr create --repo xiechimon/pacman --head xiechimon:<branch> --body-file`。

## Edge cases

- 措辞避开 `.husky/banned.txt` 禁词（临时 / 先这样 / workaround / 以后再改 / 时间紧 / TODO / FIXME / HACK）——pre-commit 会扫 staged 新增行。
- 「目标机」歧义：sqlite3 是「跑脚本那台（持库）」的需求，远端只需 ssh 互通——文中写清机器归属，避免读者装错机器。
- commit message 与 PR body 全程不出现「关票关键字 + 票号」形态（GitHub 解析器不认否定词；#1151 已关，不重引关键字）。
- docs-only 改动按仓规不跑 lint/typecheck/spec:parse；biome `files.includes` 不含 `.md`，pre-commit 自然过闸。
- push 全新分支（远端无同名分支），无需 force；禁止 `git add -A`。
- PR body 无 .drawio.svg（任务限定单文件、无机制可画图；gate 对纯文本 body 放行，图中说明写入 What 节）。

## Verification

- 红绿对（编辑前后同命令）：`grep -n '^## ' docs/ops-db-backup.md`——旧：4 节无「环境前置/排障」；新：6 节且位置正确（环境前置在备份前、排障在文末）。
- 实物取证（本机即 mea，timer 在跑）：`systemctl --user status pacman-db-backup.service`（最近一次 status=0/SUCCESS、输出尾部）、`journalctl --user -u pacman-db-backup.service`（start → wrote → pushed → backup done 全链）、`command -v sqlite3`（/usr/bin/sqlite3）——证明文档写的命令真实可用、输出形态与文档描述一致。
- pre-commit hook 链在 commit 时实际通过（lockfile 闸 + banned vocab + biome ci）。
- PR body 先 `python3 scripts/pr-evidence-gate.py /tmp/pr.md` 本地过闸，开 PR 后 `gh pr view` 回读确认。
