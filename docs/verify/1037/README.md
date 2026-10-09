# #1037 新建定时「部分按钮点不动」— 三层成因双向证据

判据：**看起来可点的东西，点下去必须有可解释的结果**。三层成因各给
改前实测读数（`before/`）与改后实测读数（`after/`），同一探针同一脚本。

## 复跑

```sh
cd apps/web && pnpm exec vite build --mode fixture && cd ../..
node docs/verify/1037/probe-1037-faces.mjs before   # 需 checkout 到改前代码
node docs/verify/1037/probe-1037-faces.mjs after    # 改后
```

探针自起 `vite preview`（PROBE_PORT，缺省 5378），跑完自收；
`before|after/readings.json` 是全部读数，png 是逐面截图。

## a 面 — fixture 哑按钮（改前读数 → 改后读数）

| 控件 | before | after |
|---|---|---|
| 空态「新建定时」点击 → dialog 计数 | **0（哑）** | 1 |
| 顶栏「新建」点击 → dialog 计数 | **0（哑）** | 1 |
| 频率 tab 点「每周」→ 选中位 | **仍是「每天」（哑）** | 「每周」 |
| 「保存」点击 → dialog 关 / 卡落列表 | **1 / 0（哑）** | 0 / 1 |

改后保存走会话创建覆面（`fixtures/deletions.ts` 的 markScheduleCreated，
重载还原——删除覆面同律）；截图 `after/a2-after-save.png`、
`after/a4-after-save.png`（卡面带「每周运行」频率词）。

## b 面 — live 面假行（改前 → 改后）

| 读数 | before | after |
|---|---|---|
| dialog 内 ChevronRight polyline 计数 | **3** | 0 |
| 项目/任务/机器行结构 | DIV，role=null，tabindex=null，**各带 1 chevron** | DIV，role=null，tabindex=null，chevron=0 |

行是静态展示行却带 picker 可供性暗示（r2 §6.6 只登记参考站预选值，
picker 交互未观测）——chevron 整族移除，值槽加 truncate：live 面 spec
（`apps/web/e2e/schedules-live.spec.ts`）用 124 字符不可断词标题钉住
「不撑爆 488 面板」。日期档 `onPick={() => undefined}` 空操作改为回显。

## c 面 — 对话框无上限（900×420 实测，票面推算坐实）

| 读数 | before | after |
|---|---|---|
| 面板 boundingBox | **y=-32.5，height=485**（封顶=372） | y=24，height=**372**（恰为封顶） |
| 保存钮在视口 | **false（y=404.5，底边 436.5>420）** | true |
| 取消钮 / X 钮在视口 | **false / false** | true / true |
| dialog-body 滚动容器 | **不存在（计数 0）** | 存在且 scrollHeight>clientHeight |
| 滚到底后保存钮位移 | —（无滚动容器可滚） | 0（footer 钉底） |

票面「按类名推算单次档 ≈495px、更矮视口上下溢出无处可滚」——实测
485px、y=-32.5，**坐实**。改后收编 DialogShell 家族律容器。

## d 面 — ?scenario= 传播契约

before：chip 计数 0（fixture 模式无自我声明）。after：chip 计数 1、
文案「示例数据（scenario 11）」，`pointer-events-none`（提示自己绝不能
成为下一个点不动的控件），live 面无 chip。传播本身保持设计行为
（sidebar 携带 live search，18+ 断言钉住 URL 携带；生产 build 编译期
折叠该参数）。

## 附带修复 — DialogShell #389 焦点回陷的采样缺陷

接线后 overlay-focus 的焦点回还断言先红：诊断探针实测（probe 已随诊断
结束移除，读数记录于此）——

```text
p1 schedules 顶栏钮开层 → Esc 后 activeElement = BODY   （回陷失败）
p2 sidebar 新建任务开层 → Esc 后 activeElement = BUTTON （回陷成功）
```

根因：`useReturnFocus` 旧实现按渲染周期采样 activeElement，而「点击开层」
路径上 mousedown 落焦到 open 提交之间通常没有渲染——p2 的成功只是恰好有
中间渲染，是巧合不是机制。改为 focusin 事件跟踪后：

```text
p1 → Esc 后 activeElement = BUTTON.group/button（顶栏钮，回陷成功）
p2 → 原样不变
```

## spec 双向记录

- `spec-run-red.log`：改前代码 + 新守卫 → **7 failed / 1 passed**（唯一
  绿的是「live 面无 chip」守卫位，改前恒真）。dead-buttons 点不动、
  overlay-focus 无层可关、dialog-viewport 无 dialog-body 可滚、
  schedules-live 数出 3 个 chevron、chip 不存在——每条都红在缺陷本体上。
- `spec-run-green.log`：改后 → **8/8 passed (4.7s)**。
- `e2e-full-summary.txt`：全量 859 用例 858 绿；唯一红 board-dnd 按
  同-sha-重跑判据定为并行负载 flake（单跑 25/25 绿），与本改动无关。
