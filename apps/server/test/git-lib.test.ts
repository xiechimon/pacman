// lib/git.ts 缝级回归（#216）：runGit 写子进程 stdin 期间子进程先关读端
// （早退/不消费输入）→ 在途写吃 EPIPE；该错误不携带结果信息（退出码/stdout
// 才是结果面），无 error 监听时以 unhandled error 击穿进程——CI 上 vitest 因
// 此判整跑挂（459/459 全绿亦枉然，run 36038226922 stack 直挂 git.ts:46
// Socket.end → _write → EPIPE）。
//
// 确定性触发（探针实测 300/300，不靠时序 race）：body > pipe buffer（64KB）
// + `git --version`（从不读 stdin、毫秒级退出）→ 首写填满管道、子进程退出、
// drain 中的余量写必吃 EPIPE。CI 发作形态（首写即 EPIPE）与本形态仅差在哪次
// write 命中，同 emitter、同 error code、同缺的监听 → 同一道防护覆盖。

import { afterEach, describe, expect, test } from 'vitest';
import { runGit } from '../src/lib/git.js';

const BIG_STDIN = new Uint8Array(1024 * 1024).fill(0x61); // 1MB ≫ 64KB 管道缓冲

describe('runGit stdin 写端兜底（#216）', () => {
  const leaked: Error[] = [];
  const onUncaught = (e: Error) => {
    if ((e as NodeJS.ErrnoException).code === 'EPIPE') leaked.push(e);
  };

  afterEach(() => {
    process.removeListener('uncaughtException', onUncaught);
  });

  test('子进程不读 stdin 即退 → 在途写 EPIPE 不得以 unhandled error 漏出，Promise 正常落定', async () => {
    process.on('uncaughtException', onUncaught);
    try {
      const r = await runGit(['--version'], { stdin: BIG_STDIN });
      // 结果面不变：吞写端错 ≠ 吞子进程结果
      expect(r.code).toBe(0);
      expect(r.stdout.toString('utf8')).toContain('git version');
      // EPIPE 经 write 回调上浮（探针实测先于 close 落定）；让一轮宏任务再断言
      await new Promise((resolve) => setImmediate(resolve));
      expect(leaked).toEqual([]);
    } finally {
      process.removeListener('uncaughtException', onUncaught);
    }
  });
});
