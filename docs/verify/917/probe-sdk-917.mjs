#!/usr/bin/env node
// #917 实物取证探针（claude-code 侧机制，真 SDK/CLI + 真模型，非源码推断）。
// 三组 before/after：
//   A. deny 路径规则在 bypassPermissions 下挡 Read
//      （A1 before = 无规则读成功；A2 after = Read(//dir/**) 规则在位被拒）
//   B. 原生 Skill 工具面的白名单执行（B1 = 原生清单实数基线；B3 before =
//      无规则时未授权技能可被 Skill 工具加载；B4 = 仅 Read deny 是否连带挡
//      Skill 内容加载；B5 after = Read deny + Skill(name) deny 必须拒）
//   C. 新选项组（settingSources 显式含 'project'）不伤 CLAUDE.md 简报通道
//      （C1 = worktree CLAUDE.md 里的 codeword 被模型回出）
// 运行：仓库根 `node docs/verify/917/probe-sdk-917.mjs`
// 前提：本机 claude 登录态（或 ANTHROPIC_API_KEY）；模型缺省 glm-5.3，
//       PROBE_MODEL 可覆写。产物 = 同目录 probe-results.json。

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sdk = await import(
  new URL(
    '../../../apps/daemon/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs',
    import.meta.url,
  ).href
);

const SECRET_MARKER = 'SECRET-MARKER-917';
const BRIEF_MARKER = 'BRIEF-MARKER-917';
const SKILL_CONTENT_MARKER = 'SKILL-CONTENT-MARKER-917';
// 与 daemon 的 CLAUDE_SETTING_SOURCES 同值（spec 14 §裁决后的范围 1）。
const SETTING_SOURCES = ['user', 'project', 'local'];
const MODEL = process.env.PROBE_MODEL || 'glm-5.3';

/** 与 claude-code.ts buildSkillDenyRules 同形：`Read(/<绝对路径>/**)`。 */
function denyRule(baseDir) {
  const escaped = baseDir.replaceAll(/([\\*?[\]])/g, '\\$1');
  return `Read(/${escaped}/**)`;
}

async function runOnce(label, options, prompt, timeoutMs = 150_000) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  const out = { label, model: MODEL, init: null, result: null, is_error: null, error: null };
  try {
    const q = sdk.query({ prompt, options: { ...options, abortController: abort } });
    for await (const msg of q) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        out.init = {
          permissionMode: msg.permissionMode,
          claude_code_version: msg.claude_code_version,
          model: msg.model,
          tools: msg.tools,
          tool_skill_present: (msg.tools ?? []).includes('Skill'),
          skills: msg.skills,
          skills_count: (msg.skills ?? []).length,
          slash_commands_count: (msg.slash_commands ?? []).length,
        };
      }
      if (msg.type === 'result') {
        out.result = typeof msg.result === 'string' ? msg.result : JSON.stringify(msg.result);
        out.is_error = msg.is_error ?? false;
        out.permission_denials = msg.permission_denials ?? null;
      }
    }
  } catch (err) {
    out.error = String((err && err.message) ?? err);
  } finally {
    clearTimeout(timer);
    try {
      abort.abort();
    } catch {}
  }
  return out;
}

/** relay 通道有间歇故障史：每组最多 3 次尝试，全部留档。 */
async function runProbe(label, options, prompt) {
  const attempts = [];
  for (let i = 0; i < 3; i++) {
    const attempt = await runOnce(`${label}#try${i + 1}`, options, prompt);
    attempts.push(attempt);
    if (attempt.error === null && attempt.result !== null) return { label, attempts };
  }
  return { label, attempts };
}

const root = mkdtempSync(join(tmpdir(), 'pac-917-probe-'));
const evidence = { generated_at: new Date().toISOString(), sdk_model_requested: MODEL, probes: {} };

try {
  // —— 场地：work 目录（cwd）+ 未授权「技能」目录（deny 目标）———————————
  const work = join(root, 'work');
  mkdirSync(work, { recursive: true });
  const secretDir = join(root, 'secret-skill');
  mkdirSync(secretDir, { recursive: true });
  const secretFile = join(secretDir, 'SKILL.md');
  writeFileSync(secretFile, `${SECRET_MARKER}\nunauthorized skill body.\n`, 'utf8');

  const base = {
    cwd: work,
    model: MODEL,
    permissionMode: 'bypassPermissions',
    settingSources: [...SETTING_SOURCES],
  };
  const readPrompt = [
    `Use the Read tool to read the file ${secretFile}.`,
    'If the tool returns the file content, reply with exactly the first line of the file.',
    'If the tool call is denied or errors, reply with exactly: DENIED',
  ].join('\n');

  // A1 before：无 deny 规则（bypass 下 work 外文件可读 = 现状漏洞面）。
  evidence.probes.A1_before_no_deny = await runProbe('A1-before-no-deny', base, readPrompt);
  // A2 after：同场地 + settings.permissions.deny（daemon 的 worker 步形态）。
  evidence.probes.A2_after_deny = await runProbe('A2-after-deny', {
    ...base,
    settings: { permissions: { deny: [denyRule(secretDir)] } },
  }, readPrompt);

  // B1：原生清单实数（issue 背景「产品不拥有、也不知情」的实物基线）。
  const okPrompt = 'Reply with exactly: ok';
  evidence.probes.B1_native_default = await runProbe('B1-native-default', base, okPrompt);

  // B3/B4/B5：原生 Skill 工具面调用三态（project 档技能种进 scratch cwd 的
  // .claude/skills——不动 ~/.claude；SKILL.md 内容含独立 marker，prompt 不
  // 泄露该 marker——回出 marker = 技能内容真的进了模型上下文）。
  //   B3 before：无规则 → 调用成功（= 白名单在原生面上的洞）
  //   B4：仅 Read deny 规则 → Skill 工具的内容加载是否连带被挡（机制问题）
  //   B5：Read deny + Skill(name) deny → 调用必须被拒（口径 4 的完整形态）
  const skillWork = join(root, 'skill-work');
  const skillDir = join(skillWork, '.claude', 'skills', 'probe-skill');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    [
      '---',
      'name: probe-skill',
      'description: Probe skill for verification. Tells the agent a secret codeword.',
      '---',
      '',
      `When invoked, reply with exactly: ${SKILL_CONTENT_MARKER}`,
      '',
    ].join('\n'),
    'utf8'
  );
  const skillPrompt = [
    'Use the Skill tool to invoke the skill named probe-skill.',
    'Follow whatever instructions the loaded skill gives you and reply accordingly.',
    'If the Skill tool call is denied or returns an error, reply with exactly: DENIED',
  ].join('\n');
  const skillBase = { ...base, cwd: skillWork };
  evidence.probes.B3_skill_invoke_before = await runProbe(
    'B3-skill-invoke-before',
    skillBase,
    skillPrompt
  );
  evidence.probes.B4_skill_invoke_read_deny = await runProbe(
    'B4-skill-invoke-read-deny',
    { ...skillBase, settings: { permissions: { deny: [denyRule(skillDir)] } } },
    skillPrompt
  );
  evidence.probes.B5_skill_invoke_skill_deny = await runProbe(
    'B5-skill-invoke-skill-deny',
    {
      ...skillBase,
      settings: { permissions: { deny: [denyRule(skillDir), 'Skill(probe-skill)'] } },
    },
    skillPrompt
  );

  // C1：CLAUDE.md 简报通道在显式 settingSources 下存活（spec 24 承重位重验）。
  const briefWork = join(root, 'brief-work');
  mkdirSync(briefWork, { recursive: true });
  writeFileSync(
    join(briefWork, 'CLAUDE.md'),
    `# Project brief\n\nThe project codeword is ${BRIEF_MARKER}.\n` +
      'When asked for the codeword, reply with exactly the codeword and nothing else.\n',
    'utf8'
  );
  evidence.probes.C1_brief_channel = await runProbe(
    'C1-brief-channel',
    { ...base, cwd: briefWork },
    'What is the project codeword? Reply with exactly the codeword.'
  );

  // —— 判定（三组都取「成功尝试」的实物字段）————————————————————
  const last = (p) => (p.attempts.find((a) => a.error === null && a.result !== null) ?? null);
  const a1 = last(evidence.probes.A1_before_no_deny);
  const a2 = last(evidence.probes.A2_after_deny);
  const b1 = last(evidence.probes.B1_native_default);
  const b3 = last(evidence.probes.B3_skill_invoke_before);
  const b4 = last(evidence.probes.B4_skill_invoke_read_deny);
  const b5 = last(evidence.probes.B5_skill_invoke_skill_deny);
  const c1 = last(evidence.probes.C1_brief_channel);
  const loaded = (r) => !!r && r.result.includes(SKILL_CONTENT_MARKER);
  const refused = (r) => !!r && !r.result.includes(SKILL_CONTENT_MARKER);
  evidence.verdicts = {
    A_before_read_succeeds: a1 ? a1.result.includes(SECRET_MARKER) && !/DENIED/.test(a1.result) : false,
    A_after_read_denied: a2 ? /DENIED/.test(a2.result) && !a2.result.includes(SECRET_MARKER) : false,
    A_permission_mode_is_bypass: a1?.init?.permissionMode === 'bypassPermissions' && a2?.init?.permissionMode === 'bypassPermissions',
    B_native_listing_count: b1?.init?.skills_count ?? null,
    B3_skill_invocable_before: loaded(b3),
    B4_read_deny_blocks_skill_load: refused(b4),
    B5_skill_deny_blocks: refused(b5),
    C_brief_channel_alive: c1 ? c1.result.includes(BRIEF_MARKER) : false,
  };
  console.log(JSON.stringify(evidence.verdicts, null, 2));
} finally {
  const out = new URL('./probe-results.json', import.meta.url);
  writeFileSync(out, JSON.stringify(evidence, null, 2), 'utf8');
  console.log(`evidence written: ${out.pathname}`);
  rmSync(root, { recursive: true, force: true });
}
