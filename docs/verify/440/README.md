# #440 验证证据索引

| 目录 | 面 | 结果 |
|---|---|---|
| `manual-round-native/` | 原生对话框真人手动轮（选取→回填→提交 201 落库） | 3/3 PASS（result.json + api-projects.json 真值） |
| `20260929-161913-fs-pick-native/` | 自动化 probe 首轮（无人值守超时轮）——留作**对话框弹出瞬间整屏截图**（02-native-dialog.png）与浏览钮界面态（01）证据；result.json 的轮1 FAIL = 240s 内无人点选，非缺陷 | 机制面已证（无降级提示 = 探测通过） |
| `20260930-001153-project-new-form/` | 既有回归：新建项目表单 probe（浏览钮加入后） | 19/19 PASS |
| `20260930-001211-local-repos-api/` | 既有回归：local 项目 API 三态 probe | 13/13 PASS |

自动化面（不在本目录，CI/本地跑）：

- `apps/web/e2e/project-new-fs-pick.spec.ts` 6/6（web 契约面：按钮在场/回填/取消静默/降级提示/busy 单发/覆盖手改）
- `apps/server/test/fs-pick.test.ts` + `wire.test.ts` 共 27 条（422 降级 wire 形状 + 路由对拍收编）
- 长挂实测：vite proxy + Chromium fetch 双探针 330s 存活（#440 评论「施工第一颗雷」）→ 同步阻塞形成立
