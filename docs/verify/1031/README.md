# verify 1031 — /app/account 两个控件真接线（改名落库 + 通知开关双向）

一个 live 栈跑 #1031 验收（探针 `drive-1031-account-controls.mjs`，真 vite dev
+ 真 server + 真 SQLite，零 daemon 零 LLM）。缺陷判因（票面浏览器实测指纹）：
① 改名压根没接线（名称行 = 纯文本 + 装饰铅笔，无 button/onClick）；② 推送
通知开关结构性单向（checked 完全受控于 permission，granted 态点「关」
aria-checked 恒 true）。

- 栈：VERIFY_PORT 8791 / VERIFY_WEB_PORT 5273 / PACMAN_HOME = lane worktree
  `.claude/verify-run/home`（scratch 全新库，seed 用户 `Owner`）。
- 结果：**26/26 PASS**（`result.json`，`ok=true`）。

## 复跑

```sh
VERIFY_REPO_ROOT=<lane> node .claude/skills/verify-pacman/scripts/launch.mjs
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  node .claude/skills/verify-pacman/scripts/drive-1031-account-controls.mjs
```

改名段跑真 PATCH → 真 SQLite，会把 seed 用户从 `Owner` 改成 `改名验证-1031`；
重跑前先 `cleanup.mjs` + `launch.mjs` 取全新库（基线断言 = `Owner`）。

## 分工：本 probe 证什么、fixture e2e 证什么

| 面 | 载体 | 为什么在这 |
|---|---|---|
| 改名一次往返**落真库** | 本 probe（live 栈 + better-sqlite3 只读回读 user 行） | fixture e2e 走 route stub，证不到真 SQLite 落库与刷新持久 |
| 开关 granted/denied 双向 + 偏好持久 + 拦截解释 | 本 probe（live 生产构建）| 证明开关在**生产构建**上接线，偏好落真 localStorage |
| 开关 default 态 + 三态确定性 + sse 抑制闸 | fixture e2e（`account-controls.spec` S5/S6、`notify-click.spec` T5）| headless 真权限 API 不可靠（grantPermissions 不翻 `Notification.permission`、requestPermission 恒 default），桩是稳定表达三态的唯一通道；sse 抑制需 SSE 帧驱动 |

开关权限档在本 probe 用与 e2e 同形的确定性 `Notification` 桩驱动（headless
真权限 API 不可靠，见上）；被测面是「偏好 × 权限 → checked / 拦截解释」的
接线，权限是其输入。

## 证据索引

### ① 改名（真 live 栈 + 真 SQLite 落库）

| 文件 | 内容 |
|---|---|
| `00-user-me-baseline.json` | 基线 `GET /api/user/me` → `displayName: "Owner"`（全新库 seed 单用户） |
| `01-account-before.png` | 改名前帐号卡：名称行 = `Owner` + 铅笔（现为真 button 载体，非纯文本） |
| `02-account-editing.png` | 点名称进编辑态：内联输入框预填 `Owner` 且聚焦 |
| `03-user-me-after-rename.json` | 提交后 `GET /api/user/me` → `displayName: "改名验证-1031"`（API 真值） |
| `04-sqlite-user-row.json` | **SQLite `user` 行只读回读** → `displayName: "改名验证-1031"`（DB 真值，落库实证） |
| `05-account-after-reload.png` | 刷新后行面仍是新名（落库持久，非组件态残影） |

改名 checks：R1 名称行 = button 载体 + 铅笔带可访问名「编辑」（旧面 = 纯文本
div / 装饰 svg，getByRole button 恒 0）；R2 点进编辑态；R3 预填 + 聚焦；R4
Enter 提交落行；R7 API + SQLite 双真值 = 新名；R8 刷新持久。

### ② 推送通知开关（live 生产构建，granted/denied 两态双向 + 持久）

| 文件 | 内容 |
|---|---|
| `06-switch-granted-on.png` | granted 态无偏好 → 开关初始 = 开（跟随权限） |
| `07-switch-granted-off.png` | granted 态点「关」→ `aria-checked=false`（旧面 = 结构性空操作，恒 true）+ `localStorage pacman.notifyEnabled=0` |
| `08-switch-denied-on-hint.png` | denied 态点「开」→ `aria-checked=true` + 拦截解释行「浏览器已拒绝通知权限，需到站点设置重新允许」 |
| `09-switch-denied-off.png` | denied 态再点「关」→ `aria-checked=false`，拦截解释随关档撤下 |

开关 checks：granted 初始开 / 关得掉（S1）/ 关档落 localStorage / 刷新持久
（S2）/ 开回来不触发 requestPermission（已授权，`__permCalls=0`）；denied 初始
关 / 关态不出解释（无「显示开却不弹」矛盾）/ 点开驱动一次 requestPermission
（#114 路径，`__permCalls=1`）/ 开态出拦截解释（S3/S4）/ 刷新持久 / 关得掉且
解释撤下。
