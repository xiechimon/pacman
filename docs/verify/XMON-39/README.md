# 创建 Agent 弹窗「模型」区显示裁切（票 XMON-39）

本目录是**实现方自己的复现证据**，随 PR #550 一起提交。独立验证方的对照证据在 `docs/verify/XMON-40/`。

## 为什么这些图要提交进仓库

Multica 的附件 URL 对匿名读者不可读——`static.multica.ai/...` 返回 `403 MissingKey`（CloudFront 要签名 Key-Pair-Id），`multica.ai/api/attachments/<id>/download` 返回 `401`。把它们直接嵌进 GitHub PR body 只会渲染成碎图。

GitHub 的 PR body 只能嵌 URL，本地文件没有 URL。所以「截图能在 PR 里看到」这件事，落到施工上只有一条通路：**把图提交到任务分支的 `docs/verify/<票号>/`，PR body 用 `https://raw.githubusercontent.com/xiechimon/pacman/<sha>/<path>` 引用**（repo 是 public，raw 匿名可读）。本地留副本只是保底，不是通路。

## 复现口径

`apps/web` 起 dev（`PACMAN_DEV_WEB_PORT=5391`，5173 被别的车道占着），`/api/**` 用 Playwright route 喂 stub：一个 40 模型的自定义 provider + claude-code 段 3 模型 = **44 行候选**。打开创建 Agent 弹窗、展开「模型」菜单。

仓内 fixture 没有长列表，故用 stub 喂「全量模型列表」的真实形态；数据形状与真实 provider 响应一致，不是在 DOM 上造假。

## 图

| 文件 | 视图 | 读数 |
|---|---|---|
| `xmon39-before-dialog.png` | 修前，弹窗局部（520×470） | 菜单上沿被弹窗体切成平口，第一行直接是 `vendor/model-03`——「未设置模型」与 `model-01/02` 不在画面里 |
| `xmon39-before-full.png` | 修前，整窗（1440×732） | 同一状态的全窗口上下文 |
| `xmon39-after-dialog.png` | 修后，弹窗局部（520×470） | 菜单整块落在弹窗体裁剪盒内，首行「未设置模型」回来；行数仍是 44 |

修前逐行探针（`elementFromPoint` + 真实点击）：

```
row 0「未设置模型」  y=145  hit=div.dlg-backdrop               click=TimeoutError
row 1 vendor/model-01 y=176 hit=div.dlg-backdrop               click=TimeoutError
row 2 vendor/model-02 y=206 hit=button.overlay-click-catcher   click=TimeoutError
row 3 vendor/model-03 y=237 hit=row                            click=ok
```

即：清不掉已选模型，最前面两个模型也选不了；菜单已滚到顶，再滚只会把这些行推得更远——永远不可达。

几何（修前）：`.dlg-body`（`overflow-y: auto`）y 240 → 492；菜单盒 y 140 → 440（吃家族值的 300px 封顶）；触发钮上缘 y 444。

修后同一探针：菜单整块落在 body 内（y 248 → 440），6 行可见，行 0–5 全部 `hit=row` 且 `click=ok`，末行 `claude-haiku-4-5` 仍 `click=ok`。

## 相关

- 实现改动：`apps/web/src/routes/agent-detail.css` 的 `.dlg-agent-model-menu` 加 `max-height: 192px`（该面向上展开的可用高度实测 200~202px）。
- 自动用例：`apps/web/e2e/agent-create-model.spec.ts` 新增一条 44 行候选的几何 + 可达性用例。
- 独立验证（真实滚轮 + 真实点击、改动前后对照）：`docs/verify/XMON-40/README.md`。