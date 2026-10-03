# todo 提及渲成 chip 验证（票 #675）

chief 系统提示词让 LLM 用 `[#n](todo:<id>)` 引用任务（`apps/server/src/services/chief.ts`），
但 transcript 侧的 `MENTION_SCHEME` 正则只认 `agent|skill|project|machine` 四个 scheme——
todo 提及整段以字面 markdown 漏进总管抽屉 / transcript / 文档 pane。修法 = 正则补 `todo:`
+ mention 段携带 wire id + `.mention-chip--todo` 规则复活（t-0019 判死、#663 删除的那条，
本次按用户 2026-10-02 裁决救活）+ todo chip 接 `/app/todo/<id>` 点击导航。

## 证据形态

**成对驱动**：同一探针脚本（`probe.cjs`，live-mock 总管抽屉，assistant 消息原文携带
`[#24](todo:t-24)` 与三个字面负例）分别驱动两套 fixture-preview 栈，两侧只差代码版本：

- `before-chief-todo-literal.*` = `origin/main`（633afa37，一次性 detached worktree 构建）
- `after-chief-todo-chip.*` = 本分支（修复后）

跑法（栈 = `vite build --mode fixture && vite preview`，探针走 playwright chromium，
路由 mock 全部 `/api/**`，SSE 用替身 EventSource）：

```sh
NODE_PATH=<repo>/apps/web/node_modules node probe.cjs http://127.0.0.1:<port> <outPrefix>
```

## 读数

| 量 | before（未修） | after（已修） |
|---|---|---|
| `.mention-chip--todo` 数 | **0** | **1** |
| 字面 `[#24](todo:t-24)` 漏出 | **true** | **false** |
| chip 文本 / 元素 | — | `#24` / `<a>` |
| chip href | — | `/app/todo/t-24` |
| chip 颜色 / 底 / 圆角 | — | `rgb(99,102,241)` / `rgba(99,102,241,.15)` / `3px` |
| cursor | — | `pointer` |
| `.mention-chip--agent`（回归对照） | 1 | 1 |
| prose `任务 #12` 不出 chip（防吃宽） | true | true |
| `[伪链](todos:t2)` 保持字面（相邻 scheme） | true | true |
| `[空](todo:)` 保持字面（空 id） | true | true |

## 参考站实拍（todos.dev，2026-10-03 登录态实测）

- `ref-desc-chip-todo11.png`：任务 #12 详情描述里的 todo 提及 chip（wire 原文
  `[#11](todo:JcK-J9TbRWQ7XAVeItm9q)`，经应用自身 API 取回核对）。
- `ref-drawer-msg-chips.png`：总管抽屉消息行内的 `24` / `23` todo chip 与
  `r5-scribe` / `r3-builder` agent chip（wire 原文
  `[#24](todo:i6vExz8kvz5Ug-bCkl5gI)`，同款 link 形）。
- `ref-drawer-todo-chip-hover.png`：hover 态特写——无 tooltip/popover、底色不变，
  仅 `cursor: pointer`。
- 点击实测：todo chip `24` → 导航 `/app/todo/i6vExz8kvz5Ug-bCkl5gI`；agent chip
  `r5-scribe` → 导航 `/app/resources/agents/<id>`。参考站渲染期还发
  `GET /api/todos/<id>?seq=<n>` 做 seq→todo 解析。
- 参考站 chip 几何（computed style）：stone 底 `rgb(232,226,217)` + 边框
  `rgb(226,219,209)`、圆角 6px、高 18px、padding 1px 5px、gap 3px、max-width 200px；
  图标 10×10 lucide file-check `text-indigo-500`；文字 `rgb(87,83,78)` 12px/14px。
  pacman 侧按 #311 既定的 per-kind accent 家族对齐（indigo = 参考站 todo 图标身份色），
  不搬 stone 容器——家族一致性裁决记录在 issue #675。
