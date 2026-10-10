# verify-pacman #1166 — drive.mjs api-key + search 探针迁移到语义载体

## 问题

`scripts/drive.mjs` 的 api-key 与 search 两条探针选择器停在 per-face 类退役
（#950/#910 语义载体迁移）之前：探针仍在等已删除的 `.keys-*` / `.search-*` 类名，
在当前 main 上 `waitForSelector` 超时（不是 app 坏了）。

## 改动

`scripts/drive.mjs` 两条探针路径改骑语义载体（对照 `apps/web/e2e` 既有 spec 用法）：

| 旧（退役类选择器） | 新（语义载体） |
|---|---|
| `.keys-empty` | `getByTestId('keys-empty')` |
| `.keys-create` | 空态内 `getByRole('button', { name: '新建密钥' })` |
| `.apikey-form-create` | `getByRole('dialog', { name: '新建密钥' })` → 弹窗内 `getByRole('button', { name: '创建' })` |
| `.keys-once-value` | 一次性块内明文字形 `code` 元素 |
| `.keys-row` | API `masked` 字段在列表 DOM 的渲染（`getByText(masked, { exact: true })`） |
| `.search-panel` | `getByRole('dialog', { name: '搜索' })` |
| `.search-input-row input` | 面板 scope 内 `getByRole('textbox')` |
| `.search-row--todo` | `locator('[data-row-kind="todo"]')`（旧 `#159` 的 `data-row-kind` 继任载体） |

api-key 两步建钥流（#287：`keys-empty` 钮开弹窗 → 弹窗「创建」提交）语义不变。
search 探针的 ⌘K retry 改为「先看后按」：冷编译下首按若慢开，旧写法会在下一次
retry 重按成奇偶同 toggle 把面板按回关，新写法每轮先查可见性再决定是否重按。

一次性明文块在件内无 `role`/`aria`/`testid` 载体（页源码仅空态挂 `data-testid="keys-empty"`），
故取块内明文字形 `code` 元素（稳定内容元素，非退役 per-face 类）；块就绪以块内
「复制」钮可见为准。

## 验收

栈坐标：api `http://127.0.0.1:8791`（`VERIFY_PORT` 8791）、web `http://127.0.0.1:5273`
（`VERIFY_WEB_PORT` 5273），全新库（`launch.mjs` 起，seed 用户 Owner）。

- `drive api-key` — 6/6 PASS：`api-key/result.json` + 3 张截图
  （空态 / 两步弹窗 / 一次性明文块）
- `drive search` — 2/2 PASS：`search/result.json` + `search/02-search-results.png`

两路径零退役类选择器（`grep -nE '\.[a-z].*(keys-|search-)' scripts/drive.mjs`
仅命中新增注释文字与截图文件名，无选择器命中）。

修复前基线（origin/main 未迁移的探针）：`before/api-key-stale-selector-result.json`
— `probe 异常:page.waitForSelector: Timeout 15000ms exceeded ... waiting for
locator('.keys-empty')`（`okscreenshot` 见 `before/api-key-stale-selector-99-error.png`）。

## 复跑配方

```sh
node .claude/skills/verify-pacman/scripts/cleanup.mjs
node .claude/skills/verify-pacman/scripts/launch.mjs      # 全新库（api-key 探针要求空态）
node .claude/skills/verify-pacman/scripts/drive.mjs api-key
node .claude/skills/verify-pacman/scripts/drive.mjs search
node .claude/skills/verify-pacman/scripts/cleanup.mjs
```

api-key 探针的「新建密钥」钮只在空态渲染，复跑前必先重 launch 拿全新库。