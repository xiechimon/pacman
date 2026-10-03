# #690 Checkbox 原语迁 Base UI 官方件——零像素验证证据

方法：fixture 构建双栈对拍。before = origin/main（62d38e06）detached worktree + `vite build --mode fixture` + `vite preview` :4310；after = 本分支同形构建 + preview :4311。探针（`probe.mjs`，node + @playwright/test chromium，viewport 1280×800）在两个栈上走同一路径：accept 弹窗（scenario 34）与 provider 自定义端点表单（scenario 01）各拍勾选态 / 未勾选态，accept 加拍键盘 Tab 焦点态（#388 focus 环）；每次截图前先 `getAnimations().finished` 落定弹层入场动效（#677 起 tw-animate-css 真接线，不落定会吃到瞬时 scale）。逐部件 computed-style + boundingBox 记入 `geometry-*.json`，`compare.py` 对表出 `geometry-diff.md`。

| 文件 | 内容 |
|---|---|
| `before-*.png` / 同名无前后缀 | before / after 截图：dialog 裁剪 + `-full` 整页 |
| `geometry-before.json` / `geometry-after.json` | 逐部件几何 + computed style 原始记录（含 mechanism 部件） |
| `geometry-diff.md` | 对表结论：**全部截图 md5 逐字节一致**；visible 部件盒模型与样式全一致；两处已声明的非视觉差异（tile `role` null→checkbox = 官方件在视觉元素上公布 ARIA role；label `position` relative→static = 退役 input 覆盖层的死锚点删除），各附理由 |
| `probe.mjs` / `compare.py` | 复跑入口 |
| `e2e-related.log` | 相关 e2e 运行日志：checkbox-unified / provider-add-dialog / merge-reject / dialog-viewport / board-filter = **50 passed** |

**覆盖面声明**：fixture 栈可达的复选面 = accept 弹窗 + provider Bearer 行，两面全拍。stop-confirm（fixture 无 running 态）与 api-key 弹窗（新建按钮 `live` 门控）在 fixture 栈不可达；两者消费同一原语同一 `checkbox.css`，tile 几何与状态样式已由前两面 md5 钉死；stop-confirm 的 live 面证据链沿用 `docs/verify/XMON-72/`（drive-stop 探针）。api-key 弹窗的工具网格是原语唯一的无 children 形态，其盒模型 = label 仅包 tile，几何同由 tile 部件对拍覆盖。

**全量收尾**：web e2e 全量跑两次，均 616 passed / 1 failed，且两次失败的钉**不同**（首跑 `board-dnd.spec.ts:366`「committed drop never flashes back」，二跑 `board-overflow` 滚动钉）——两条 spec 与 checkbox 零涉及（grep 命中 0），单拎独跑各自全绿（11/11、6/6）：全量并发下的负载型 flake，非本改动回归。repo vitest **1313/1313 passed**。`pnpm lint` / `pnpm -r typecheck` 绿。

**mechanism 部件（记录用，不参与对拍）**：迁移前原生 input 是 18×18 opacity-0 覆盖层垫在 tile 下；迁移后是 Base UI 官方 visually-hidden input（1×1 + `clip-path: inset(50%)` + `position: fixed`）。两种隐藏技术不可比，探针打 `mechanism` 标签单列于 `geometry-diff.md` 尾节。

**复跑**：
```sh
# before 栈
git worktree add --detach /tmp/pacman-690-before origin/main
cd /tmp/pacman-690-before && corepack pnpm install
cd apps/web && corepack pnpm exec vite build --mode fixture
corepack pnpm exec vite preview --host 127.0.0.1 --port 4310 --strictPort &
# after 栈：本分支 apps/web 同形 build + preview :4311
# 探针 + 对表（probe.mjs 内 playwright 绝对路径按检出位置调整）
node probe.mjs http://127.0.0.1:4310 /tmp/out-before before
node probe.mjs http://127.0.0.1:4311 /tmp/out-after after
python3 compare.py   # 输入路径在文件头，指向两个 geometry.json
```
