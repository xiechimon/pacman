#!/usr/bin/env node
// verify-pacman archive — 把一次 probe 的证据目录归档进仓库的
// docs/verify/<ticket>/,让它随 PR 进 git。证据在 .claude/verify-evidence/ 下
// 只是 gitignored 本地态:lane 在 worktree 跑时该路径随 worktree 删除而永久
// 丢失(M7 #310/#319 实测——PR body 声称跑过 verify-pacman,证据目录在主仓
// 根本不存在),所以归档是每个带 verify 声明的 PR 的必做收尾步。
//
// 用法:node archive.mjs <证据目录> <ticket>
//   <证据目录>  probe 输出目录(绝对或相对)
//   <ticket>    issue 号(纯数字,如 310)
//
// 归档根 = 脚本位置所在仓库(主仓),与 VERIFY_REPO_ROOT 无关:lane 的栈跑在
// worktree,归档必须落主仓才可能进 PR。落盘后调 `git check-ignore` 自检——
// 归档进被忽略的路径等于没归档,直接报错退出。

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// resolve 不是多余:fileURLToPath 对 '..' 形式返回带尾斜杠的路径,直接 slice
// 取相对路径会多吃一个字符(实测踩过)。
const REPO = resolve(fileURLToPath(new URL('../../../..', import.meta.url)));
const ARCHIVE_ROOT = join(REPO, 'docs', 'verify');

const [srcArg, ticket] = process.argv.slice(2);
if (!srcArg || !ticket) {
  process.stderr.write('usage: node archive.mjs <证据目录> <ticket>\n');
  process.exit(2);
}
if (!/^[0-9]+$/.test(ticket)) {
  process.stderr.write(`error: ticket 须为 issue 号(纯数字),收到「${ticket}」\n`);
  process.exit(2);
}

const src = isAbsolute(srcArg) ? srcArg : resolve(process.cwd(), srcArg);
if (!existsSync(src) || !statSync(src).isDirectory()) {
  process.stderr.write(`error: 证据目录不存在或非目录:${src}\n`);
  process.exit(1);
}

const dest = join(ARCHIVE_ROOT, ticket, basename(src));
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

// 归档路径必须真能进 git:被 .gitignore 命中的话这次归档对 PR 毫无意义。
// check-ignore 退出码 0 = 命中忽略,1 = 未命中(即我们要的结果)。
const rel = relative(REPO, dest);
try {
  execFileSync('git', ['-C', REPO, 'check-ignore', '-q', rel], { stdio: 'ignore' });
  process.stderr.write(`error: 归档路径被 .gitignore 忽略,进不了 PR:${rel}\n`);
  process.exit(1);
} catch {
  // 未命中忽略 = 正常
}

let summary = '';
const resultPath = join(dest, 'result.json');
if (existsSync(resultPath)) {
  const r = JSON.parse(readFileSync(resultPath, 'utf8'));
  const checks = Array.isArray(r.checks) ? r.checks : [];
  summary = `result.json ${checks.filter((c) => c.ok).length}/${checks.length} checks ok`;
}
const pngs = readdirSync(dest).filter((f) => f.endsWith('.png')).length;
const manifest = [summary, `${pngs} 张截图`].filter(Boolean).join(' + ');

process.stdout.write(
  `\n归档:${rel}\n` +
    `内容:${manifest}\n` +
    `PR body 引用行:验证证据 \`${rel}/\`(${manifest})\n` +
    `收尾:git add ${rel} 并随 PR 提交(证据未进 PR = 验证声明不可查证)\n`,
);