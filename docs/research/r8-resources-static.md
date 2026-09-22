# R8 · 资源面静态随拍（#69 路由批 A 内置补拍动作）

> 分工出处：03 §4（静态面逐 web 票随拍）+ 04 附录 C（资源页弹窗表单图标缺口）。
> 拍摄时间：2026-09-22（漂移复核拍 `raw/drift-skills-light.png` 同场）。
> 素材：Ego 浏览器 TaskSpace「pacman r8 resource modal captures (issue #69)」，free 档已登录账号（与 r2/r7 同 profile `mon (2)`）。
> 编号：续 r7（54+）；起于 69 —— 64/66/72 号票的 r8 批次已占用 54–68，本批顺延避撞。

## 0. 捕获方法

- 视口：`Emulation.setDeviceMetricsOverride` 1440×732 / DPR 1（**不动窗口**——浏览器为并行票共享；override 小于物理视口，无 r5/r6 式右缘钳制）。
- 主题：每场前置 `localStorage.tds-theme=light`；侧栏展开态。
- 稳定判定：`document.fonts.ready` + rAF；弹窗另等「连续两拍字节一致」后才截（开场的透明度动画约 1.5s，固定延时不够）。
- 截图面 1440×732 px，与 parity harness 视口一致。

## 1. 清单（`docs/research/assets/r8/`）

| 文件 | 面 | 备注 |
|---|---|---|
| `69-新建技能-从文件夹-light.png` | `/app/resources/skills/import` 从文件夹 tab | 表单几何权威（本票实现已对拍） |
| `70-新建技能-从GitHub-light.png` | 同路由 从 GitHub tab | |
| `71-添加MCP弹窗-远程-light.png` | MCP 添加弹窗（远程 HTTP） | 448 宽居中律同 r7 §3.5 |
| `72-添加MCP弹窗-stdio-light.png` | 同弹窗 类型=本地命令（stdio） | |
| `73-添加密钥弹窗-light.png` | 密钥添加弹窗 | |
| `74-添加机器弹窗-light.png` | 机器添加弹窗 | **配额墙变体**：free 团队已有 1 台机器 → `当前套餐最多 1 台机器…` + `升级到 Pro`；r2 11b 的 CLI 两步表单在当前账号状态不可达 |
| `75-内置模型详情弹窗-light.png` | 模型服务内置卡详情 | 模型清单已漂移（见 §3） |
| `icons-modals.json` | 7 个 scope 的 svg dump（41 唯一 markup） | 补 04 附录 C「资源页弹窗表单图标」缺口；dialog scope = `[role=dialog]`，import 两 tab = 整页 |
| `raw/drift-skills-light.png` | 漂移复核拍 | vs r7 08 ssim 0.995（差异全在 §3 小区域） |

## 2. 门禁处置

- 矩阵 `resources-skills-import-*-light` 两行保持 **smoke**：69/70 基线携带 §3 的活体状态（用量行/徽标/头像 FAB），与冻结壳契约（r7 壳）不可同时对齐；gating 等 A6 重拍裁决。
- 六路由各加一行 **dark smoke**（双主题按需）：r7 无深色资源基线，深色面先验管线与 [推断] 深色 token，gated 深色对等 A6 裁决。
- 71–75 为**参考基线**入库：弹窗实现票（M0+ 弹层票流）的对拍素材；本票不实现弹窗面。
- `parity/run.mjs` 支持 `r8/` 前缀基线解析（04 §2 合同扩展；本票暂无行引用）。

## 3. 漂移记录（触 A6 判定输入，不在本票裁决）

1. 侧栏 资源组新增 `用量` 行（机器 与 模型服务 之间）——r7（09-21）无。
2. 总管 FAB 在有未读总管消息时渲染**头像 + 未读徽标**，非 r7 的机器人脸。
3. 看板 行注意力徽标随团队 todo 状态出现（并行票探针所致，非站点漂移）。
4. 模型服务页新增 `内置（pi）/ Claude Code / Codex` tab 行；内置模型清单增减（`Grok 4.7` 等新 slug）。
5. 机器行右侧新增三个行内动作图标（在线机器）。
6. 以上 1/2/4/5 为站点漂移事实；按 A6 由重拍裁决统一切换基线批次，本票 r7 门禁行不受影响（对照冻结批次）。

## 4. 盘点后 space 状态

TaskSpace 已 `finish({keep:[]})` 关闭；未写入任何团队数据（仅开弹窗后 Esc，零提交）。
