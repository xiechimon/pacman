# #778 取证：总管抽屉内部 wake 标记剥离

## 问题

daemon 内部 wake 标记（如 `[wake:gate]`）出现在总管抽屉的用户气泡里，
用户误以为是输入框里的符号。

## 漏点

1. wake 步 prompt 入队即带前缀（`apps/server/src/services/chief.ts`
   `enqueueChiefStep`）：`[wake:<trigger>] <正文>`。
2. daemon 把 `step.prompt` 原文当 transcript `user-<stepId>` 行上传
  （`apps/daemon/src/runner.ts`，prompt 行落库）。
3. 用户触发的回合有 POST 行孪生可去重；wake 轮没有 POST 行，回声行被
   `mapChiefStream` 原样渲染成用户气泡（旧 `F-C4` 断言即此行为）。

## 修法

`apps/web/src/api/mappers.ts`：`mapChiefStream` 在用户可见边界剥离前导
`[wake:*]` 同族（`gate/settle/failed/wake`，与 server `parseChiefTrigger`
同正则族），只动显示层：

- 落库（`chief_message` / `step.prompt`）不动，claim 解析不受影响；
- 去重键吃剥离后文本，POST + wake 回声同 remainder 仍恰渲染一条；
- 纯 marker 行不渲染；句中 marker 保留；assistant 行不动（协议 token
  永不经该面产生）。

## 证据

- `before.png`：原代码渲染（含 `[wake:gate]` 前缀）。
- `after.png`：同一 mock 同一视角，标记已剥离，remainder 逐字保留。
- 两图同一取证 harness（live mock 路由 + `?chief=chief-bbb`）逐帧产出，
  非手工拼图。

## 校验

- `test/chief-user-echo.test.ts` + `test/chief-markdown.test.ts`：46/46 通过
  （含新增 `F-W1..W6`）。
- `apps/server/test/chief.test.ts`：44/44 通过（server 未动，回归确认）。
- `e2e/chief-stream-markdown.spec.ts`：14/14 通过。
- `pnpm lint` / `pnpm typecheck` 全绿。
- 全仓 `rg '[wake:'`：生产代码仅剩协议定义（`chief.ts`
  `WAKE_PROMPT_PREFIX` + claim 解析）与本剥离正则两处机制引用，
  无用户面字面残留。
