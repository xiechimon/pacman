# t-0059 遗留：i18n-coverage 扫描器自旋（#681 的活体现场）

2026-10-03 协调者清场时实测到的**孤儿进程**，正是 #681 描述的死循环的**活体实例**。

## 事实

- `pid 85912`（父）→ `85919`（vitest fork worker），ppid=1（已孤儿），启动 2026-10-03 04:27:32，
  实测时已跑 **9h40m，持续 ~84–91% CPU**（独占一核）。
- 命令行 = `vitest run apps/web/test/i18n-coverage.test.ts --reporter=dot`，
  cwd = `.../worktrees/pacman/hp-pacman-t-0059-todo-chip-scheme-mention-chip-todo/apps/web`
  ——该 worktree **已被删除**（cwd 悬空），线程 t-0059 早已 resolve。

## `sample(1)` 抓到的热栈（`sample.txt`，4s / 1ms 间隔，3189 个样本全在同一处）

```
Builtins_RunMicrotasks
Builtins_PromiseFulfillReactionJob
Builtins_AsyncFunctionAwaitResolveClosure
Builtins_InterpreterEntryTrampoline
Builtins_ArrayPrototypeFlatMap          ← apps/web/test/i18n-coverage.test.ts:293 `files.flatMap(scan)`
Builtins_FlattenIntoArrayWithMapFn
??? (in <unknown binary>)               ← JIT 后的 JS：即 mapFn `scan()` 本体
  3189/3189 样本停在这里（无推进、无 IO、无分配抖动）
```

## 读法（一条结论、一条排除）

- **结论**：自旋在 **`scan(file)` 内部**——`flatMap` 只是调用者（它的迭代长度是固定的，不会因数组增长而变长）。
- **排除**：不是 flatMap 遍历被增长数组拖死，也不是 IO / GC；是**纯 JS 计算自旋，且不推进**——与 #681 的「zero-advance」判断吻合。

## 复现上下文

- 触发面是 t-0059 的分支内容（该票补了 `todo:` / 提及 chip 的 **SCHEME 正则**）——`#` 出现在正则字面量里，正是 #681 的触发器。
- **main 不复现**（main 的 CI 绿，且 i18n-coverage 属 light 项目每次 `pnpm test` 都会跑）→ 该自旋由**特定的正则字面量形态**触发，不是全仓常态。
