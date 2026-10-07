#!/usr/bin/env tsx
// #923 证据 probe：pi-coding-agent 0.86.0 → 1.0.4 升级的技能目录注入链路对照。
//
// 形态：integration harness 同构（integration/test/skills-inject-e2e.test.ts 的
// 引导面）——真 HTTP server + 真 daemon machine-loop + 真 PiBackend + stub LLM
// （openai-completions SSE），全进程内、随机端口，一次派发一个真实 build 步。
//
// 注入面有两路，证据分开取：
//   A. daemon 受控目录（本 probe 的对照主体）：PACMAN_SKILLS_DIR fixture →
//      buildSkillsCatalog（allowlist 过滤 → cap 闸 → formatSkillsForPrompt）→
//      简报文件通道（#958）进 LLM 输入。
//   B. pi 引擎宿主机自动目录：DefaultResourceLoader 自身扫 `~/.agents/skills`
//      （0.86 与 1.0.4 同有该扫描，package-manager skillDirs），内容是宿主机
//      私有技能清单——证据只记条目数/嵌套数 facts，文本脱敏不落盘。
//
// 断言对照（票 #923 验收 seam 2「一次真实 step 端到端，含技能目录注入那条链路，
// 证明 catalog 内容与升级前一致或更好」；A 面两面都必须全 PASS）：
//   1. 步端到端：build 步 claim → PiBackend 会话 → 三轮 stub（read 工具真读
//      SKILL.md / bash 真改动过 #703 闸 / 收尾）→ todo 相位到 review。
//   2. A 面目录：daemon catalog 含 demo-skill（绝对路径 location）、嵌套
//      nested-skill、longdesc 截 200 + `…`；handtyped
//      （disable-model-invocation:true）整条剔除；allowlist 外 unauthorized-skill
//      被滤（[skills] filtered 行）；agent 职责文本在位（追加不覆盖）。
//   3. 连通性硬验收：第二轮请求携 read 工具结果 = SKILL.md 正文 marker。
//   4. #958 简报文件通道：brief written / brief removed 行在位、步后 worktree
//      不留 AGENTS.md。
//   5. B 面 facts（两面记录、README 对照）：宿主自动目录条目数、嵌套分组条目
//      数（上游 0.87+ 发现面修复的可观测位）。
//
// 用法（两面同一脚本；before 面在 origin/main 一次性 worktree 内跑）：
//   env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY \
//       -u ALL_PROXY NO_PROXY='*' FACE=before|after EXPECT_PI_VERSION=<版本> \
//       [VERIFY_EVIDENCE_DIR=<证据目录>] [VERIFY_REPO_ROOT=<栈仓根>] \
//       apps/daemon/node_modules/.bin/tsx docs/verify/923/probe-923-catalog.mjs
//
// 环境契约：SKILLS_DIR 用固定路径（/tmp/pacman-923-skills）——catalog 的
// location 是绝对路径，两面同径才能逐字节 diff。

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDaemonConfig } from '../../../apps/daemon/src/config.js';
import { createDaemonLogger } from '../../../apps/daemon/src/log.js';
import { runMachine } from '../../../apps/daemon/src/machine-loop.js';
import { agent as agentTable } from '../../../apps/server/src/db/schema.js';
import { statePaths } from '../../../apps/daemon/src/state.js';
import {
  AGENT_ID,
  api,
  bootRealServer,
  daemonLogLines,
  seedWorld,
  waitFor,
} from '../../../integration/test/helpers.js';
import { startStubLlm } from '../../../integration/test/stub-llm.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.VERIFY_REPO_ROOT
  ? resolve(process.env.VERIFY_REPO_ROOT)
  : resolve(SCRIPT_DIR, '../../..');
const FACE = process.env.FACE === 'before' ? 'before' : 'after';
const EXPECT_PI_VERSION = process.env.EXPECT_PI_VERSION ?? null;
const EVIDENCE = process.env.VERIFY_EVIDENCE_DIR ?? SCRIPT_DIR;
const SKILLS_DIR = '/tmp/pacman-923-skills';
const MARKER = 'SKILL-CATALOG-MARKER-923';
const LONG_DESC = `long-description-parity-probe-${'x'.repeat(185)}`; // 215 字符 > 200 cap
const LONG_DESC_KEPT = LONG_DESC.slice(0, 200); // 截断产物 = kept + '…'
/** allowlist 勾选面（handtyped 勾而不现——format 层剔除；unauthorized 不勾）。 */
const ALLOWLIST = ['demo-skill', 'nested-skill', 'longdesc', 'handtyped'];

const piPkgPath = join(
  ROOT,
  'apps/daemon/node_modules/@earendil-works/pi-coding-agent/package.json',
);
const piVersion = JSON.parse(readFileSync(piPkgPath, 'utf8')).version;
// drizzle-orm 从 server 包解析（probe 自身零依赖；docs/verify/622 probe 同法）。
const requireServer = createRequire(join(ROOT, 'apps', 'server', 'package.json'));
const { eq } = requireServer('drizzle-orm');

const checks = [];
let failures = 0;
const check = (ok, label, detail) => {
  checks.push({ ok, label, detail: detail ?? null });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// —— fixture skills 目录（确定性重建；固定路径 = 两面 catalog 可逐字节 diff）——
function skillFile(dir, name, description, extraFrontmatter) {
  mkdirSync(join(SKILLS_DIR, dir), { recursive: true });
  writeFileSync(
    join(SKILLS_DIR, dir, 'SKILL.md'),
    [
      '---',
      `name: ${name}`,
      `description: ${description}`,
      ...(extraFrontmatter ?? []),
      '---',
      '',
      `# ${name}`,
      '',
      `正文 marker：${MARKER}`,
      '',
    ].join('\n'),
    'utf8',
  );
}

function buildSkillsFixture() {
  rmSync(SKILLS_DIR, { recursive: true, force: true });
  skillFile('demo-skill', 'demo-skill', `演示技能：读到正文即证明技能目录链路可达（${MARKER}）。`);
  // 分组目录里的嵌套技能（上游发现面对照）。
  skillFile(
    join('group', 'nested-skill'),
    'nested-skill',
    '分组目录里的嵌套技能（发现面对照）。',
  );
  // 手敲型（disable-model-invocation 语义对照——勾选在名单内也必须整条剔除；
  // frontmatter 正典键 = kebab-case，skills.js:262 两版同式）。
  skillFile('handtyped', 'handtyped', '手敲型技能：目录面必须整条剔除。', [
    'disable-model-invocation: true',
  ]);
  // 超长 description（宿主截断闸 200 + '…'，两面同律）。
  skillFile('longdesc', 'longdesc', LONG_DESC);
  // allowlist 外对照（#372：授权语义——不勾即滤，[skills] filtered 行）。
  skillFile('unauthorized-skill', 'unauthorized-skill', '白名单外对照技能。');
  // 根 README.md（无 frontmatter 的普通文档；不应进目录——诊断面 facts 记录）。
  writeFileSync(
    join(SKILLS_DIR, 'README.md'),
    '# skills fixture root readme\n\n无 frontmatter 的根 README：不应进入技能目录。\n',
    'utf8',
  );
}

/** 消息面全部文本块（content = string | {type:'text',text}[] 两形）。 */
function collectTexts(messages) {
  const texts = [];
  for (const m of messages) {
    const c = m?.content;
    if (typeof c === 'string') texts.push(c);
    else if (Array.isArray(c)) {
      for (const b of c) if (typeof b?.text === 'string') texts.push(b.text);
    }
  }
  return texts;
}

const CATALOG_BLOCK_RE = /The following skills provide specialized instructions[\s\S]*?<\/available_skills>/g;

/** 首轮请求里的全部 catalog 块，按来源分面：daemon 受控目录（location 在
 * fixture SKILLS_DIR 下）vs pi 宿主自动目录（其余——内容脱敏）。 */
function splitCatalogs(texts) {
  const daemonBlocks = [];
  const hostBlocks = [];
  for (const t of texts) {
    for (const block of t.match(CATALOG_BLOCK_RE) ?? []) {
      if (block.includes(SKILLS_DIR)) daemonBlocks.push(block);
      else hostBlocks.push(block);
    }
  }
  return { daemonCatalog: daemonBlocks.join('\n'), hostBlocks };
}

function hostCatalogFacts(hostBlocks) {
  const joined = hostBlocks.join('\n');
  const locations = [...joined.matchAll(/<location>([^<]*)<\/location>/g)].map((m) => m[1]);
  // 口径：以路径里最后一个 `/skills/` 为根，其后 2 段 = 标准条目
  // （<root>/<name>/SKILL.md），≥3 段 = 嵌套分组条目
  // （<root>/<group>/<name>/SKILL.md，上游 0.87+ 发现面修复的可观测位）。
  const relSegments = (l) => {
    const i = l.lastIndexOf('/skills/');
    return i === -1 ? 0 : l.slice(i + '/skills/'.length).split('/').length;
  };
  const nested = locations.filter((l) => relSegments(l) >= 3);
  return {
    present: hostBlocks.length > 0,
    entryCount: locations.length,
    nestedEntryCount: nested.length,
    standardEntryCount: locations.length - nested.length,
  };
}

/** brief-context 落盘前脱敏：宿主自动目录块替换为计数占位（私有技能清单不进
 * 公开仓证据）；仓根绝对路径替换为占位符（pi 文档指针行携带安装路径，含机器
 * 用户名——公开仓证据不落）。 */
function sanitize(text, hostFacts) {
  return text
    .replace(
      CATALOG_BLOCK_RE,
      (block) =>
        block.includes(SKILLS_DIR)
          ? block
          : `[sanitized: pi host-level auto-catalog, ${hostFacts.entryCount} entries]`,
    )
    .replaceAll(ROOT, '<repo-root>');
}

// —— 主流程 ——————————————————————————————————————————————————————————————

buildSkillsFixture();
mkdirSync(EVIDENCE, { recursive: true });
const demoSkillFile = join(SKILLS_DIR, 'demo-skill', 'SKILL.md');

const stub = await startStubLlm([
  // 轮 1：agent 按 catalog 指引 read SKILL.md（绝对路径 = catalog location）。
  { toolCall: { name: 'read', arguments: { path: demoSkillFile } } },
  // 轮 2：真做一处改动（#703 闸 2——执行步无改动过不了 review 闸）。
  {
    toolCall: { name: 'bash', arguments: { command: 'printf "923 probe line\\n" >> README.md' } },
  },
  // 轮 3：收尾。
  { content: '已读取演示技能。' },
]);
const server = await bootRealServer({
  providerBaseUrl: stub.url,
  claimHoldMs: 1_000,
  agentDescription: '你是 923 验证 Agent：按指令使用工具，然后简短汇报。',
});
// allowlist 直写 DB（skills-inject 同法）：REST 写侧的 filterKnownSkillIds 吃
// server 自己的 skillsDir（集成 harness 里是隔离空目录），fixture slug 过不去。
server.db
  .update(agentTable)
  .set({ skills: ALLOWLIST })
  .where(eq(agentTable.id, AGENT_ID))
  .run();
const home = mkdtempSync(join(tmpdir(), 'pacman-923-home-'));
let handle = null;
const facts = { piVersion, face: FACE, skillsDir: SKILLS_DIR, allowlist: ALLOWLIST };

try {
  check(
    EXPECT_PI_VERSION === null || piVersion === EXPECT_PI_VERSION,
    `pi-coding-agent 安装版本 = ${EXPECT_PI_VERSION ?? '(未钉)'}`,
    `实际 ${piVersion}`,
  );

  const config = loadDaemonConfig(
    {
      serverUrl: server.url,
      apiKey: server.apiKey,
      teamId: server.teamId,
      home,
      name: `probe-923-${FACE}`,
      skillsDir: SKILLS_DIR,
    },
    {},
  );
  const paths = statePaths(config.home, config.workspacesDir);
  const logger = createDaemonLogger({ logFile: paths.daemonLog });
  handle = await runMachine({
    config,
    paths,
    logger,
    idleSleepPrevention: false,
    proxyEnv: {},
    claimBackoffBaseMs: 50,
    heartbeatIntervalMs: 500,
  });
  const logLines = () => daemonLogLines(paths.daemonLog);
  await waitFor(() => logLines().includes('[wake] push channel connected'), 30_000);

  const world = await seedWorld(
    server.url,
    server.teamId,
    { title: '923 catalog probe', spec: '读取演示技能并汇报 marker。' },
    { projectName: `probe-923-${FACE}` },
  );
  const started = await api(server.url, 'POST', `/api/projects/${world.projectId}/builds`, {
    todoIds: [world.todoId],
    assignment: { plan: null, build: { agentId: AGENT_ID } },
    withPlan: false,
  });
  const buildId = started.body?.builds?.[0]?.id ?? null;
  check(started.status === 201 && Boolean(buildId), 'POST /builds → 201 + buildId');

  // seam 2 的「真实 step 端到端」：claim → PiBackend 会话 → 三轮工具回合 →
  // 步 done → 相位翻 review。
  await waitFor(() => server.todoPhase(world.todoId) === 'review', 150_000);
  check(true, 'todo 相位到 review（真实 build 步端到端完成）');

  // —— A 面：daemon 受控目录（首轮 LLM 请求 = stub 捕获的真 wire 载荷）——
  const first = stub.requests[0];
  check(Boolean(first), 'stub 收到首轮请求');
  const firstTexts = collectTexts(first?.messages ?? []);
  const { daemonCatalog, hostBlocks } = splitCatalogs(firstTexts);
  check(daemonCatalog !== '', 'daemon fixture catalog 在首轮请求（<available_skills> 块）');
  const cat = daemonCatalog;
  check(cat.includes('<name>demo-skill</name>'), 'A：catalog 含 demo-skill');
  check(cat.includes(demoSkillFile), 'A：catalog 含 demo-skill 绝对路径 location', demoSkillFile);
  const briefText = firstTexts.find((t) => t.includes('你是 923 验证 Agent')) ?? null;
  check(briefText !== null, 'A：agent 职责文本在位（catalog 追加不覆盖）');
  check(!cat.includes('handtyped'), 'A：handtyped（disable-model-invocation:true）整条剔除');
  check(
    cat.includes(`${LONG_DESC_KEPT}…`),
    'A：longdesc 截 200 + …（宿主 cap 闸）',
    `kept=${LONG_DESC_KEPT.length} chars`,
  );
  check(!cat.includes('x'.repeat(171)), 'A：longdesc 原文全长不在 catalog（截断真发生）');
  const entryCount = (cat.match(/<skill>/g) ?? []).length;
  check(entryCount === 3, 'A：daemon catalog 恰 3 条（demo/nested/longdesc）', `实际 ${entryCount}`);

  // facts：嵌套发现面 + 宿主自动目录面（两面 README 对照，不做硬断言）。
  facts.nestedSkillInDaemonCatalog = cat.includes('<name>nested-skill</name>');
  facts.daemonCatalogBytes = Buffer.byteLength(cat, 'utf8');
  facts.hostAutoCatalog = hostCatalogFacts(hostBlocks);
  facts.firstRequestRoles = (first?.messages ?? []).map((m) => m?.role);
  facts.stubRequestCountAtAssert = stub.requests.length;

  // —— 连通性硬验收：read 工具真读到 SKILL.md，marker 随工具结果进第二轮请求 ——
  const second = stub.requests[1];
  const secondFlat = JSON.stringify(second?.messages ?? []);
  check(secondFlat.includes(MARKER), '第二轮请求携 SKILL.md 正文 marker（read 链路可达）');

  // —— #372 allowlist 授权语义 + [skills] 日志族 ——
  const skillsLines = logLines().filter((l) => l.startsWith('[skills]'));
  check(
    skillsLines.some((l) => l.startsWith('[skills] loaded:')),
    '[skills] loaded 行在位',
    skillsLines.find((l) => l.startsWith('[skills] loaded:')) ?? '',
  );
  check(
    skillsLines.includes('[skills] filtered: unauthorized-skill not in agent allowlist'),
    '[skills] filtered 行（allowlist 外语义零回归，#372）',
  );
  facts.readmeMentionedInSkillsLog = skillsLines.some((l) => l.includes('README'));

  // —— #958 简报文件通道生命周期 ——
  check(
    logLines().some((l) => l.includes('brief written:') && l.includes('(create)')),
    'daemon.log 简报写入行（brief written … create）',
  );
  check(
    logLines().some((l) => l.includes('brief removed')),
    'daemon.log 简报擦除行（brief removed）',
  );
  const agentsMdLeft = existsSync(join(paths.workspacesDir, buildId ?? '', 'AGENTS.md'));
  check(!agentsMdLeft, '步收尾后 worktree 不留 AGENTS.md（延迟污染闸）');

  // —— 证据落盘（catalog/skills-log 全文；brief-context 脱敏宿主目录块）——
  writeFileSync(join(EVIDENCE, `${FACE}-skills-log.txt`), `${skillsLines.join('\n')}\n`, 'utf8');
  writeFileSync(join(EVIDENCE, `${FACE}-catalog.txt`), `${cat}\n`, 'utf8');
  const contexts = firstTexts
    .filter((t) => t.includes('<available_skills>') || t.includes('你是 923 验证 Agent'))
    .map((t) => sanitize(t, facts.hostAutoCatalog));
  writeFileSync(
    join(EVIDENCE, `${FACE}-brief-context.txt`),
    `${contexts.join('\n\n---8<--- next text block ---8<---\n\n')}\n`,
    'utf8',
  );
} catch (err) {
  check(false, 'probe 异常终止（已观察事实仍落盘）', String(err?.message ?? err));
} finally {
  const result = {
    probe: 'pi-upgrade-catalog',
    ticket: '923',
    face: FACE,
    at: new Date().toISOString(),
    piVersion,
    checks,
    facts,
  };
  writeFileSync(
    join(EVIDENCE, `${FACE}-result.json`),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );
  try {
    await handle?.stop();
    await handle?.done;
  } catch {}
  try {
    await server.close();
  } catch {}
  await stub.close();
  rmSync(home, { recursive: true, force: true });
  rmSync(SKILLS_DIR, { recursive: true, force: true });
  console.log(`\n${checks.length - failures}/${checks.length} PASS（${FACE} 面，pi ${piVersion}）`);
  console.log(`evidence: ${EVIDENCE}`);
  process.exitCode = failures === 0 ? 0 : 1;
}
