# docs/verify/1033 — 总管抽屉思考行/工具行头像几何（#1033）

隔离 live 栈（server + vite dev，全新库、独立 `PACMAN_HOME`），探针
`.claude/skills/verify-pacman/scripts/drive-1033-avatar.mjs`：铺底全走公开
REST + **假机器**（provider / agent / PATCH chief 绑定 / POST chief/threads /
api-key / machine enroll / claim），按真 wire 序推思考段行 + 正文段行 +
工具行开始半（回合保持在飞 = 工具行可见），零 daemon、零 LLM
（drive-chief-segments 同律）。浏览器面拦截 dicebear 域并按**真 Lorelei
形态** fulfill：无 width/height 属性、`viewBox="0 0 980 980"`——票面验收
判据原样，约束缺失时该形态必撑满容器宽。

几何全部**同帧单 evaluate** 量取（跨帧两次 boundingBox 采样会在抽屉入场
动画期产出假倒挂，e2e:affected 并行轮实测踩过）。

## 结果

| 面 | 栈 | 结果 |
|---|---|---|
| after（本 PR 分支，8795/5277） | 修复后代码 | **7/7 PASS**（`after/result.json`） |
| before（origin/main 一次性 worktree，8796/5278） | 未修复代码 | **5/5 PASS = 症状复现**（`before/result.json`） |

关键读数（`geometry.json`）：

| 判据 | before | after |
|---|---|---|
| 头像 img 渲染尺寸 | **383×383**（撑满列宽，症状本体；用户现场 380×380 同源） | **24×24**（AVATAR_IMG_CLS 的 `[&_img]:size-6`） |
| 思考行 display | **block**（死类名，头像独占一行、正文被推到图下方） | **flex** |
| 消息列 flex-grow | **0** | **1**（MSG_COL_CLS 的 `min-w-0 flex-1`） |
| 头像/正文相对位 | 上下堆叠 | 同帧实测 `col.x(1296) > img.x(1262)` 且垂直重叠 = 头像在文字左侧 |
| 工具行骨架 | block / grow 0 | flex / grow 1（G5） |

## 证据文件

- `after/` 与 `before/` 各含：
  - `result.json` — checks 逐条 ok/label/detail + 栈坐标 + 线程/步 id。
  - `geometry.json` — 同帧量取的行/img/列矩形与 computed style 原值。
  - `01-drawer-avatar-{new,old}.png` — 抽屉截图（before 巨图 / after 24px 头像位）。
  - `02-fullpage-{new,old}.png` — 全页截图。
  - `db-rows.json` — `{viaApi, viaSqlite}` 行快照（读面 + 库面实物）。
  - `drawer-text.txt` — 抽屉可读文本（截图的可 diff 版）。

## 复跑配方

```sh
# after（本分支检出，端口自定，先 lsof 查占用）
node .claude/skills/verify-pacman/scripts/launch.mjs   # VERIFY_PORT/VERIFY_WEB_PORT 覆写
node .claude/skills/verify-pacman/scripts/drive-1033-avatar.mjs
node .claude/skills/verify-pacman/scripts/cleanup.mjs

# before 基线
git worktree add --detach /tmp/pacman-before-1033 origin/main
cd /tmp/pacman-before-1033 && corepack pnpm install
VERIFY_REPO_ROOT=/tmp/pacman-before-1033 VERIFY_PORT=8796 VERIFY_WEB_PORT=5278 \
  node <本检出>/.claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=/tmp/pacman-before-1033 \
  node <本检出>/.claude/skills/verify-pacman/scripts/drive-1033-avatar.mjs --expect=old
VERIFY_REPO_ROOT=/tmp/pacman-before-1033 VERIFY_PORT=8796 VERIFY_WEB_PORT=5278 \
  node <本检出>/.claude/skills/verify-pacman/scripts/cleanup.mjs
git worktree remove --force /tmp/pacman-before-1033
```

localhost 请求一律 `env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*'`。

## CI 面（fixture e2e，与本 live 证据互补）

`apps/web/e2e/chief-stream-markdown.spec.ts`：dicebear 桩已换成真 Lorelei
形态（旧 24×24 桩自带尺寸，恰好掩蔽约束缺失），F-R19 增加同帧几何钉
（24×24 / flex / grow 1 / min-width 0 / 头像在文字左侧）。修复前实测红：
`Expected {width:24,height:24}, Received {width:383,height:383}`——CI 能真红
才算验到。
