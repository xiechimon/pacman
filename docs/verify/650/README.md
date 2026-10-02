# #650 验证证据：总管抽屉 markdown 单源 + 用户头像真值

栈：verify-pacman 隔离 live 栈（server 8795 + vite 5277，scratch PACMAN_HOME），
daemon 真进程（pi 运行时）+ stub LLM（OpenAI SSE，分 5 块、每块 1.3s 流式回复
markdown 报告）；用户 `avatarUrl` 经 scratch SQLite 直写为 stub 提供的品红 SVG
（`/api/user/me` 的 `ctx.user` 在 server 启动时缓存，故写库后重启了一次 server）。
before 面 = `origin/main` 一次性 detached worktree（8797/5279 同配方独立栈），
驱动脚本与探针同字同参（`.claude/verify-shots/chief-md/`，gitignored）。

## 文件

| 文件 | 内容 |
|---|---|
| `before-final-drawer.png` | origin/main 定稿面：`**凭证链路验证**` / `**项目**:` / `**状态**:` 字面星号漏出；用户行 = 灰色通用人形字形（写死 `ChiefUserSolid`） |
| `after-final-drawer.png` | 本分支定稿面：粗体真渲染、bullet 块、`curl /healthz` 行内 code chip、零字面星号；用户行 = avatarUrl 真值（品红 SVG） |
| `result-before.json` | before 面 checks 7/7 + 观测时间线（`before-literal-asterisks` / `before-glyph-avatar` 等） |
| `result-after.json` | after 面 checks 13/13（`no-literal-asterisks` / `bold-rendered` / `code-chip` / `bullet-blocks` / `user-avatar-real` / `user-avatar-loaded` 等） |

## 判读

- 星号：before 定稿文本含 `**`（`before-literal-asterisks` PASS 即「bug 在」）；
  after 消息流全文不含 `**` 且 `<strong>` 3 个。
- 头像：before 用户行 `img=0 glyph=1`；after 用户行 `img src=…/avatar.svg` 且
  `naturalWidth>0`（非破图）。
- 附带观察（不在本票范围）：chief 回合每轮 DB 落两条 user 行（POST 行 + daemon
  transcript 上传回声行），抽屉如实渲染——建议另票处理。
