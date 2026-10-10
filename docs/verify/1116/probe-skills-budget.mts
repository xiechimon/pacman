// #1116 探针：真 buildSkillsCatalog（apps/daemon/src/backend/pi.ts，真 pi
// loadSkills 扫描）跑票面场景——99 技能库 + 同内容团队镜像。三臂：
//   arm1  默认预算：票面验收（agent 要么全见、要么明确知道少了谁）
//   arm2  小预算覆写（--budget）：非静默截顶实物（budget: 行 + 目录尾
//         <omitted_skills> 段 + 丢名清单）
//   arm3  纯本机（无团队目录）：99 条全量可见不依赖团队面
// 复现：corepack pnpm --filter @xiechimon/pacman-cli exec tsx
//   ../../docs/verify/1116/probe-skills-budget.mts
// （在仓根 apps/daemon 的工作区内跑；tsx 解析 pi.ts 的 workspace 依赖。）
// before 侧（origin/main）同脚本同参跑——main 上 arm1 输出旧形：
//   99 行 collision + `cap: total=99 truncated=50`（即用户票面贴回的日志）。

import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSkillsCatalog } from '../../../apps/daemon/src/backend/pi.ts';

const TOTAL = 99;

function buildLibrary(root: string): void {
  for (let i = 0; i < TOTAL; i++) {
    const name = `skill-${String(i).padStart(2, '0')}`;
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: 演示技能 ${i}：占位路由描述。\n---\n\n${name} body.\n`,
      'utf8',
    );
  }
}

function runArm(label: string, opts: Parameters<typeof buildSkillsCatalog>[0]): void {
  const logs: string[] = [];
  const catalog = buildSkillsCatalog({ ...opts, log: (m) => logs.push(m) });
  const entries = catalog.split('<skill>').length - 1;
  console.log(`\n=== ${label} ===`);
  for (const line of logs) console.log(`[skills] ${line}`);
  console.log(
    `entries=${entries} bytes=${Buffer.byteLength(catalog, 'utf8')} omitted_note=${catalog.includes('<omitted_skills') ? 'present' : 'absent'}`,
  );
}

const base = mkdtempSync(join(tmpdir(), 'pacman-1116-probe-'));
const local = join(base, 'local');
const team = join(base, 'team');
mkdirSync(local, { recursive: true });
buildLibrary(local);
// 团队镜像 = 逐字节相同的副本（单机 server skillsDir = daemon skillsDir 的
// 常见形：物化视图与本机目录互为镜像 → 每条 name 都撞）。
cpSync(local, team, { recursive: true });

const arm2Budget = Number(process.argv[2] ?? '900');

runArm(`arm1: ${TOTAL} skills + identical team mirror, default budget`, {
  skillsDir: local,
  cwd: base,
  teamSkillsDir: team,
});
runArm(`arm2: same library, budget override ${arm2Budget} bytes`, {
  skillsDir: local,
  cwd: base,
  teamSkillsDir: team,
  budgetBytes: arm2Budget,
});
runArm(`arm3: ${TOTAL} local-only skills, default budget`, {
  skillsDir: local,
  cwd: base,
});

rmSync(base, { recursive: true, force: true });
