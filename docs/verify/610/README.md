# #610 用户菜单面板底边盖住账号行顶分隔线 —— 判因与修复证据

用户 dogfood 反馈（截图见 issue #610 附件）：点开左下角账号菜单，白色面板的底边与投影压在账号行上，行顶分隔线在面板宽度内消失。

## 判因（隔离栈实测，1440×732，live 模式）

- **锚定律没被改松**：展开态面板底距视口底 38px、img 顶 33.5px、净空 4.5px；rail 态 46/42/4px——与 #388 契约一致（故非 (a) 锚定回归）。
- **#388 的净空对 img 量，而可见结构边界是行盒顶**：`.sidebar-user` h-11（44px）贴视口底、img 居中 → 行顶比 img 顶高 10px，且 #414 给该行加了 `border-t` 分隔线。面板底 38px = 行顶下方 6px：不透明体 + z-30 盖住分隔线所在 6px 带（seam 处 `elementsFromPoint` 命中 `.user-menu-rows`），`--edge-shadow`（0 5px 14px）再糊到行面。回归源 = #388（当日 `.sidebar-user` 尚 `border: none`，重叠带不可见）× #414（加 seam，重叠带变可见缺陷）。
- rail 态行无 seam，仅 3px 透明盒重叠 + 投影，症状轻；同律一并修。
- **截图左下青绿色楔形（用户图 (36,175) = rgb(96,164,160)）非本仓元素**：该角 DOM 扫掠（x2–44 × 底 2–52，menu 开/关两态）只有行/aside/img；全仓 token 与组件无 #60A4A0；且用户 PNG 带 alpha 通道、楔形周围是窗影式半透明黑（0,0,0,28/48）——该区域在 app 不透明面之外，判为捕获环境叠影（窗角后方的其它窗口/壁纸），非 pacman 渲染面。

## 修复（锚定律 v3）

净空改对**触发行盒顶**量，家族 4px 不变：`bottom: 38px → 48px`（展开态行顶 44 + 4）、rail 覆写 `46px → 53px`（行顶 49 + 4）。`detail.css` `.user-menu` 注释为契约正本；`user-menu-trigger.spec.ts` 锚定断言同步改判（原对 img 的 [2,10] 窗口改为对行顶 4±1，另保留 #163「不盖头像」半律）。

## 实测前后对照（geometry.json 为全量）

| 形态 | 面板底距视口底 | 行顶距视口底 | 面板底−行顶（负=盖线） | 对 img 净空 | seam 处 hit-test |
|---|---|---|---|---|---|
| 展开 before | 38 | 44 | **−6（盖住）** | 4.5 | `.user-menu-rows`（面板） |
| 展开 after | 48 | 44 | **+4** | 14.5 | click-catcher → `.sidebar-user`（seam 可见） |
| rail before | 46 | 49 | **−3** | 4 | 面板 |
| rail after | 53 | 49 | **+4** | 11 | click-catcher → `.rail-user` |

截图：`before-expanded.png` / `after-expanded.png` / `before-rail.png` / `after-rail.png`（侧栏底 300×150 裁切，menu 开启态）。

## 复跑

verify-pacman 隔离栈（`VERIFY_PORT=8791 VERIFY_WEB_PORT=5273`）起栈后，playwright 真点击头像 chip 开菜单，读 `.user-menu` / 触发行 / 行 img 的 `getBoundingClientRect` 与 seam 处 `elementsFromPoint`；e2e 面回归 = `apps/web/e2e/user-menu-trigger.spec.ts`（锚定律 v3 断言）。
