# #1108 机器并发上限 + 排队可见 — verify 证据

probe：`drive-1108-concurrency.mjs`（真 daemon + 门控 stub LLM + Playwright）。
场景 = 用户实测现场复刻：cap=2 的机器上连发 3 条钉本机 chief 回合。

## 结果

15/15 checks PASS（`result.json` 逐条）。两遍独立运行（03-25 与 03-26 两组
`.claude/verify-evidence/` 运行，A/B/C/D 四族结果一致；第一遍 B4 假红是探针
locator 抓到 seed 本机行，非产品缺陷，修 locator 后二遍全绿）。

四族断言 → 实物：

| 族 | 声称 | 实物 |
|---|---|---|
| A 并行真跑 | cap=2 → 前两回合并发执行 | `daemon-log-tail.txt` canon 行 `(1 running)`/`(2 running)` 同秒；`stub-requests.json` 两请求 start 同刻、end 双 held（区间重叠） |
| A 闸生效 | 第三回合超 N 排队 | `steps-phase-a.json`：2 claimed + 1 pending（不进失败漏斗） |
| B 排队可见 | 位次 + 等待对象 + 机器读数 | `threads-phase-b.json` turnQueue `{position:1, waitingFor:{running:2, capacity:2}}`；`chief-drawer-queued.png` 在飞存在行「排队中：等 verify-1108（2/2 在跑，前面 0 个）」；`machines-running-2of2.png`「执行中 2/2」+「并发 2」控件 |
| C 空位交接 | done → wake → 秒级认领 | `steps-phase-c.json` claimed 回 2 / pending 归零；canon 行再现 `(2 running)`；抽屉排队行退场；`steps-final.json` 三回合全 done |
| D 写面 | PATCH 单字段 + 值域闸 | `machine-after-enroll.json`（缺省 3）→ PATCH 2 回读；0/17 → 400 |

## 复跑配方

```sh
node .claude/skills/verify-pacman/scripts/cleanup.mjs   # 旧栈必先清
node .claude/skills/verify-pacman/scripts/launch.mjs
node .claude/skills/verify-pacman/scripts/drive-1108-concurrency.mjs
node .claude/skills/verify-pacman/scripts/cleanup.mjs   # 收尾回收（证据保留）
```

门控 stub 的每请求 gate 由探针按阶段 `release(i)`——时序（A 并行窗口 → C
释放空位）由脚本自身编排，重跑不需人工干预。探针断言里机器行按
`data-machine-id` 钉位（`.first()` 会抓到 seed 的本机行——本机行也带并发
控件，排首）。
