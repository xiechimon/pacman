# #430 弹层行为契约对照（Base UI 代数）

> 状态：**TL;DR 节已完成且可复核；一/二/三/四节未完成**（见 issue #430 的收尾评论——两次车道尝试失败，第一次空转 80 分钟零落盘、第二次模型轨降档后只写出 TL;DR）。
> TL;DR 里每条都点名了 Base UI 的对应 API，可当 B1 三条车道的自查清单直接用；四节详表要的是逐条 `文件:行` 证据，尚缺。
> 证据格式：`文件:行`；未核实项标 `[未核实]`。
> 包版本：`@base-ui/react ^1.8.0`（`apps/web/package.json`，b1-overlays worktree）。
> 对照基准：`docs/research/418-dialog-contract-matrix.md`（radix 语义，分支 `research/dialog-contract`）。

## TL;DR

- Base UI 的退场机制是**数据属性驱动的 transition status + 动画结束后才置 unmount**，`onOpenChangeComplete(false)` 即 radix `onAnimationComplete`/`Presence` 的等价物；仓内「退场保挂载」语义可保留，但要放弃「只认 CSS animation」的假设——Base UI 用 `getAnimations()` 同时覆盖 animation 与 transition。
- Esc 分层：Base UI 每层 `Dialog.Root` 自带 document 级 `keydown` 监听 + `bubbles.escapeKey` 阻断，天然替代仓内 #318 的「每层 window keydown + 手工闸」；嵌套层序由 FloatingTree 的 `hasBlockingChild` 负责。
- 焦点回陷：`Dialog.Popup` 接 `initialFocus` / `finalFocus` props，最终走 Floating UI `FloatingFocusManager` 的 `returnFocus`。#389「trigger 在 dialog 树外」场景用 `finalFocus`（ref 或元素）显式指回。
- 等价面（遮罩/外点/受控/关闭三路径/嵌套层序）大多可直接切；须额外接线清单见第四节。

## 一、退场保挂载

（待补：机制对照 + 仓侧 OverlayMount 对照）

## 二、Esc 分层

（待补）

## 三、焦点回陷

（待补）

## 四、等价面与须额外接线清单

（待补）
