# verify 900 — 过闸 actor 审计三票联合证据（覆盖 #902 / #900 / #901）

一个 live 栈跑三票验收（探针 `drive-902-gate-actor.mjs`，纯 REST + 假机器
wire + Playwright 真拖拽，零 daemon 零 LLM）。目录统一放 `900/`，按任务书
注明覆盖三票；`new-*` = 本分支栈（after），`old-*` = `origin/main` 一次性
worktree 独立栈（before，8793/5275）。

- after 栈：VERIFY_PORT 8791 / VERIFY_WEB_PORT 5273 / PACMAN_HOME = lane
  worktree `.claude/verify-run/home`（scratch 全新库，seed 用户 Owner）。
- before 栈：`git worktree add --detach /tmp/pacman-main-902 origin/main` +
  corepack install + 同探针 `--expect=old` 重放。

## 复跑

```sh
VERIFY_REPO_ROOT=<lane> node .claude/skills/verify-pacman/scripts/launch.mjs
node .claude/skills/verify-pacman/scripts/drive-902-gate-actor.mjs --expect=new
# before 基线：main worktree 栈起在 8793/5275 后
VERIFY_RUN_DIR=<main 栈 run dir> node .../drive-902-gate-actor.mjs --expect=old
```

结果：after **17/17 PASS**（`result-new.json`），before **7/7 PASS**
（`result-old.json`）。GIF 由 Playwright recordVideo 录像经 ffmpeg 转出
（拖拽是动效，#901 票面要求 GIF 证据）。

## 逐票证据索引

### #902 过闸动作记 actor（announcement 行）

| 文件 | 内容 |
|---|---|
| `new-sqlite-message-rows.json` | 回读校验：SQLite `message` 行全量 dump——todo1 `通过了确认`/`标记为已完成` actor=`Owner`（人），todo2 `通过了确认` actor=`verify-chief`（chief 绑定 Agent，不是用户名） |
| `new-wire-messages-todo1.json` | `GET /api/conversations/{id}/messages` 封套行含 `actor` 位 |
| `new-detail-timeline-actor-notes.png` | 详情页时间线渲染「Owner 通过了确认」「Owner 标记为已完成」note 行 |
| `old-wire-messages-todo1.json` | before：同款 confirm 过闸后 wire 零宣告行、表无 actor 列 |

### #900 chief 不得自过 review 闸（complete_todos）

| 文件 | 内容 |
|---|---|
| `new-chief-complete-todos-receipt.json` | toolcall 侧回执：chief relay `complete_todos` 对 review 卡 → `{transitioned:[], skipped:[todo2], reasons:{todo2:"待确认/审核关口的 done 落地必须由人过闸…"}}`；探针同轮断言相位仍 review、零审计行 |
| `new-chief-confirm-receipt.json` | 同链路上 chief `confirm_builds` 照常放行（闸只咬 done 落地） |

### #901 confirm/review 拖向 done 确认弹层 + 审计行

| 文件 | 内容 |
|---|---|
| `new-drag-done-dialog.png` | review(有变更) 卡拖向已完成：确认弹层出现，卡停源列（确认前零提交） |
| `new-drag-done-landed.png` | 点「确认完成」后落位已完成列 |
| `new-drag-review-to-done.gif` | after 全程动效：拖起 → 弹层 → 确认 → 落位 |
| `old-drag-review-to-done.gif` / `old-drag-done-landed.png` | before：同一拖拽在 main 栈零弹层静默落位、库里零审计行（#892 病灶复现） |

## 判据备注

- SQLite `message.content` 是 drizzle json 列（字符串值带引号存储），比对
  canon 前要先 `JSON.parse`——直接字符串等值会假阴性（本轮实测踩中，探针
  已内置解析）。
- 弹层判据（web `columns.needsDoneGate`）只咬「闸相位 ∧ hasChanges」；
  审计行判据（server `todos.updateTodo`）覆盖全部闸相位 done 落地——弹层
  是 UI 位、行是审计位，两判据有意不同宽（#892：无码可审的测试卡清理是
  合理人肉路径，但落地一律留痕）。
