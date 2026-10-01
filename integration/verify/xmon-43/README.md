# XMON-43 看板验证探针

独立验证 XMON-38 报告的两处看板 bug。只读验收标准写测试，不读实现推断需求；不改
`apps/` 与 `packages/` 任何文件。探针只用 HTTP 驱动 fixture 构建，不 import 产品代码。

## 跑法

先起被测构建的 fixture 预览（每个 worktree 各自 build，互不干扰）：

```sh
# 在被测 worktree 的 apps/web 下
pnpm install && pnpm exec vite build --mode fixture
pnpm exec vite preview --host 127.0.0.1 --port <PORT> --strictPort
```

再跑探针（`BASE_URL` 指向上面那个端口）：

```sh
BASE_URL=http://127.0.0.1:8477 node integration/verify/xmon-43/verify.mjs \
  --out docs/verify/XMON-43/evidence/pr --label pr
```

退出码 0 = 全过，1 = 有不过；逐条读数落 `--out` 下的 `<label>-result.json`，截图落
`<label>/shots/`。跑一次约 60–90 秒（20 条检查、27 个页面上下文）。

## 检查项与它钉的失败方式

| id | 钉的失败方式 | 判定 |
|---|---|---|
| A1 | 首卡上缘落在滚动容器的裁切线上（gapTop = 0） | gapTop ≥ 1px，三个场景各一条 |
| A2 | 横向卡缘让位被本次改动动到 | 左右 gap ≥ 1px（修前修后应同为 7.25px） |
| A3 | 首卡上缘那一像素画的是列底色（卡环被裁） | 该像素 ≠ 列底色参考像素 |
| A4 | 滚到底时末卡下缘贴裁切线 | gapBottom ≥ 1px（仅对可滚动的列判） |
| A5 | — | 8× 左上角 + 4× 列顶截图留证 |
| B1 | 同看板内连续切换卡片后落点与新开不一致、或返回后看板状态被改 | 三轮 A→B→A 落点与新开逐字一致 + 看板复原 |
| B2 | 同路由换参（详情 A → ⌘K → 详情 B）不重挂载导致残留 | 落点与新开一致、无残留浮层、渲染 id = 路由 id |
| B3 | 上一张卡开着的浮层跟到下一张卡 | 换卡后 `.more-menu-item` = 0 |
| B4 | 逐张扫掠里有任何一张落点漂移或留下状态 | 12/12 全等 |
| C1 | 两张不同看板之间切换时数据面串号、落点漂移 | 各自落点与新开一致、列内容不串 |
| D1 | 被驱动面上出现 console error / 页面异常 / 失败请求 | 0 条 |
| D2 | — | 记录 `.board-column` 出现在哪些路由（验收第 1 条措辞的证据） |

「落点与新开一致」的口径：同一条详情 URL 在一个**独立新页面**里冷加载后的读数，与
「在应用内切过去」的读数逐字对比。比对字段是用户可见面——`data-todo-id`、整个
`.detail-shell` 的规整化可见文本、右栏文本、路径，外加残留浮层计数。fixture 数据是确定性
的，所以逐字对比可用；比 composition 指纹更接近「用户看到的是不是同一张卡」。

## 结果

| 构建 | commit | 结果 |
|---|---|---|
| PR 551 分支（含 `py-px`） | `1f83107f` | **20/20 通过** |
| 其父提交（无该改动） | `38c945b9` | **13/20**，红的 7 条全是 A 组 |

红绿两边只差 PR 551 那一个提交，所以 A 组七条红→绿是这次改动的因果，不是环境漂移。
完整读数见 `docs/verify/XMON-43/evidence/{pr,baseline}/result.json`。