# XMON-25 验证证据:pages 域切 shadcn

`apps/web/src/pages/` 裸控件收口到 `components/ui/*`。基线(origin/main `4647eaf`)实测账面:35 处裸 `<button>` + 5 处裸 `<input>` + 4 文件 6 处老 `ui/Button`;迁移后 = 36 处 `<Button>` + 5 处 `<Input>`,pages/ 内 `../ui/` 老原语 import 清零。残留 5 处 role=option/menuitem 菜单行(裸 `<button>`,语义是 listbox/menu 选项行而非按钮)在 PR body 逐项声明。纯结构变更——视觉零重钉,per-face CSS 值仍是几何/颜色正典。证据四组(全部为基线 `4647eaf` 上的当轮输出):

## 1. 像素纪律(验收 3:零视觉重钉)

对照 = 干净基线(`4647eaf`,/tmp/xmon25-baseline detached worktree,preview 8471)+ 迁移后本树(preview 8472);14 视口 × 明暗双主题 = 28 视图(新建项目三面/仓库菜单/GitHub picker/目录浏览器/项目任务面/任务空态/任务菜单/文件面/issues 弹窗/日程三面/项目设置),采集端等所有 overlay/入场动画落定后才取数。

- `pixel-diff.txt` — 结构化 computed-style 对拍(628 个迁移目标元素,rect/颜色/字体/圆角/阴影/outline/文本/aria 全量属性):
  **0 处未解释差异**,1454 项差异全部落在 11 个惰性白名单族(data-slot 属性/nowrap/transition 族/flexShrink/justifyContent/gap 族/display/alignItems),每族均经图像对拍验证不可见;族普查与逐面中性化机理(leading-[inherit]、rounded-none、size-auto 等)在文件头。
- `style-diff.txt` — 上述对拍的完整逐元素清单(28 视图 × 628 元素)。
- `pixel-imgdiff.txt` — chromium canvas 逐像素对拍 28 对整视口截图:
  **28/28 完全一致**(通道差阈值 >8,无一像素越线)。

## 2. 行为 e2e(验收 2:域行为全绿)

- `e2e-relevant.txt` — 开发期 pages 域相关 17 spec(E2E_PORT=8461,proxy 全 unset):
  **144 passed**(27.3s)。覆盖 dir-browser/fs-pick/github-issues/new-repo/new-github/tasks-toolbar/settings-delete/segmented-controls/dead-buttons/overlay-focus/user-menu 等全部改动面。
- `e2e-full.txt` — 收尾全量 `playwright test`(E2E_PORT=8461):**543 passed**(1.1m),零回归。
  注:全量跑会按 `merge-reject.spec.ts` 的证据副作用重新生成 `docs/verify/XMON-89/*.png`(与本票无关的字节抖动),已 `git checkout` 还原、不入本提交。

## 3. live 栈探针(验收 4:verify-pacman 隔离栈,API+SQLite 双真值)

隔离栈(VERIFY_PORT=8791 / VERIFY_WEB_PORT=5273 / scratch PACMAN_HOME,`doctor` 6/6 PASS;用户真数据 `~/.pacman` 与 8787/5173 真栈零触碰),全部交互点走的都是迁移后的 shadcn 件。

- `live-project-new-form/` — 新建项目表单全链 **19/19 PASS**(result.json + responses.json + 6 张截图):
  菜单恰两行(无 hosted)→ local 选态换面 + basename 回填 + 手改不覆盖 + 清空恢复 → github 回填 repo 段 → focus 环 computed style(outline none + indigo rgb(100,102,233) 边框 + 1px ring)→ 提交闸 disabled → 400 三态红色错误行(not_found/not_git,真 server 非桩)+ 编辑即撤 → local/github/未选三条创建链 `GET /api/projects` record + SQLite 行双真值(repoKind/localPath/githubRepo/NULL)。
- `live-github-oauth-picker/` — GitHub 认证 + picker 面 **13/13 PASS**:
  未连接 `{connected:false}` 恰形 → OAuth env 未配形 authorize 400 原文落内联错误行(UI 真点)→ 断开幂等 204 → repos 代理未连接 404 → 手动兜底链接切 owner/repo input → 合法 ref 放开创建钮 → 提交跳项目页 + record repoKind=github。
- `live-local-repos-api/` — local 项目 API 三态 **13/13 PASS**:
  not_found / not_git / 真 git 仓 201 三态 reason code 单源 + SQLite project 行对账 + github_connection 列集无 plaintext token 列。

## 4. 预存缺陷登记

无——像素对拍(0 未解释差异)与三组 live 探针(45/45 PASS)未发现迁移前后同态存在的 pages 域预存缺陷。

## 5. serve-live 人肉点验实例(leader 交付项)

生产同源单端口 `http://localhost:8796/app`(本机 = 用户 Mac;tailnet `http://100.125.21.46:8796/app`),scratch 数据根 + 种子两项目,tailnet 对端 mea 实测 200,无头自检 9/9 PASS(`serve-live/shots/` 6 张)。地址/看哪几处/停法/边界全在 `serve-live/profile.md`。
