#!/usr/bin/env -S pnpm exec tsx
// 只验证场景仓的种子内容有没有真的进仓——不起模型、不花钱。
// 种内容的失败是静默的（git 返回 0 但没 add 上），只有把裸仓的 tree 摊开才看得见。

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RosterAgent } from './grade.mts';
import { bootStack, resolveFromRoot, seedWorld } from './stack.mts';

const FLOW = process.argv[2] ?? '.claude/hillclimb/chief-dispatch';
const FLOW_DIR = resolveFromRoot(FLOW);
const d = JSON.parse(readFileSync(join(FLOW_DIR, 'cases.json'), 'utf8')) as {
  roster: RosterAgent[];
};

const stack = await bootStack();
try {
  const world = await seedWorld(stack, {
    relayBaseUrl: 'http://127.0.0.1:9/v1',
    relayKey: 'unused',
    roster: d.roster,
    chiefModelId: 'glm-5.3',
  });
  const bare = join(stack.server.reposDir, stack.server.teamId, 'eval-project.git');
  const git = (...args: string[]) => {
    const r = spawnSync('git', args, { encoding: 'utf8' });
    return { out: r.stdout ?? '', err: r.stderr ?? '', code: r.status };
  };
  console.log(`裸仓: ${bare}`);
  console.log('\n=== 分支 ===');
  console.log(git('--git-dir', bare, 'branch', '-a').out.trim() || '(无分支)');
  console.log('\n=== main 的完整文件树 ===');
  const ls = git('--git-dir', bare, 'ls-tree', '-r', '--name-only', 'main');
  console.log(ls.out.trim() || '(空树)');
  console.log(`\n提交历史:`);
  console.log(git('--git-dir', bare, 'log', '--oneline', '--all').out.trim() || '(无提交)');
  console.log(`\n期望 16 个文件，实际 ${ls.out.trim() ? ls.out.trim().split('\n').length : 0} 个`);
  void world;
} finally {
  await stack.close();
}
process.exit(0);
