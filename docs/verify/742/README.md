# #742 用户气泡 markdown 面 — 成对驱动证据

票面验收样例逐字进 mock：`[#16](todo:t16)` 提及 + `**bold**` 粗体 + 三面字面负例
（prose 裸 `#12` / 相邻 scheme `[伪链](todos:t2)` / 空 id `[空](todo:)`）。

- **before 栈** = `origin/main`（c91f3961，与本分支 merge-base 同一提交）一次性
  detached worktree，`vite build --mode fixture` + preview `:8413`。
- **after 栈** = 本分支同法构建，preview `:8414`。
- **同一份 `probe.cjs`**（t-0059 成对探针配方，`docs/verify/675/probe.cjs` 先例）
  分别打两栈：live-mock 路由注入 chief 线程消息，量 DOM 后落 JSON + 截图
  （chip 气泡 / bold 气泡元素图 + 整抽屉图）。

复现：

```sh
node docs/verify/742/probe.cjs <baseURL> <outPrefix>
# env: NODE_PATH=<repo>/apps/web/node_modules，代理需绕开回环
# （env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*'）
```

## 结果对照

| 观测位 | before（origin/main） | after（本分支） |
| --- | --- | --- |
| chip 气泡 `--md` 类 | false | true |
| `.mention-chip--todo` 数 | 0 | 1（`#16`，真 `<a>`，href `/app/todo/t16`） |
| `[#16](todo:t16)` 字面漏出 | **true** | false |
| `**` 字面漏出（bold 气泡） | **true** | false（`<strong>优先</strong>`） |
| 负例三面（裸 #12 / 伪 scheme / 空 id） | 字面保持 | 字面保持（chip 0，不炸不渲） |
| 单行气泡高度 | 44px | 44px（几何逐值一致） |

文件：`before-user-literal{,-chip,-bold,-drawer}.png` / `after-user-markdown{,-chip,-bold,-drawer}.png`
+ 同名 `.json`（量测原始输出）。
