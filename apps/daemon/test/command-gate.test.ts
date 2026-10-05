// 命令闸 bash 分类器 + 门控 operations（#866 T5 tracer）。
// 失败方式清单（先固化，代码是让场景通过的手段）：
// F1 误拦合法命令 → 默认放行 + 引号内字面不判 + worktree 内 rm -rf 放行；
// F2 漏放（变量/转义/编码绕行）→ 非目标（防误不防恶），但多命令链（;/&&/换行）
//   必须整串扫描，不能只看首命令；
// F3 前缀形态（sudo/env/command/nice）→ 片段 glob 全串匹配，前缀天然覆盖；
// F4 超时/取消语义 → 透传 signal 与 timeout（_fake ops 录参断言）；
// F5 大输出截断 → 委托 pi 本地 ops（行为 pi 原生，不在本文件重造）；
// F10 claude-code 覆盖缺口 → 本文件只管 pi 面，缺口在 PR/报告里明示。
import { describe, expect, it, vi } from 'vitest';
import {
  buildGatedBashOperations,
  DEFAULT_BASH_PATTERNS,
  decideBashCommand,
  formatGateRefusal,
  type PermissionRule,
} from '../src/backend/command-gate.js';

describe('默认放行（F1：合法命令一律 allow）', () => {
  const allowed = [
    'ls -la',
    'pnpm test',
    'pnpm --filter @pacman/web e2e:affected',
    'git status && git diff --stat',
    'git push origin session-123',
    'git push --force-with-lease origin session-123',
    'rm -rf ./dist',
    'rm -rf apps/web/dist node_modules/.cache',
    'rm -rf /tmp/pacman-before-main',
    'grep -r "rm -rf /" .',
    'echo "rm -rf /"',
    "echo 'mkfs.ext4 /dev/sda'",
    'find . -name "*.log" -delete',
    'vite build --mode fixture',
    '',
    '   ',
  ];
  for (const command of allowed) {
    it(JSON.stringify(command), () => {
      expect(decideBashCommand(command).action).toBe('allow');
    });
  }
});

describe('不可逆形态设闸（只对不可逆形态）', () => {
  const asked: Array<[string, string]> = [
    ['rm -rf /', 'ask-rm-rf-root'],
    ['sudo rm -rf /', 'ask-rm-rf-root'],
    ['rm -rf /*', 'ask-rm-rf-root'],
    ['rm -rf ~', 'ask-rm-rf-home'],
    ['rm -rf $HOME', 'ask-rm-rf-home'],
    // 花括号取值形（拼串避 noTemplateCurlyInString：此处 `${HOME}` 是有意的
    // shell 字面量，不是写错的模板）。
    [`rm -rf ${'$'}{HOME}`, 'ask-rm-rf-home'],
    [`rm -rf ${'$'}{HOME}/tmp`, 'ask-rm-rf-home'],
    ['rm -rf / --no-preserve-root', 'ask-rm-rf-root'],
    ['rm --recursive --force /', 'ask-rm-rf-root'],
    ['true; rm -rf /', 'ask-rm-rf-root'],
    ['ls /tmp && rm -rf ~', 'ask-rm-rf-home'],
    ['mkfs.ext4 /dev/sda1', 'ask-mkfs'],
    ['sudo mkfs -t ext4 /dev/sdb', 'ask-mkfs'],
    ['dd if=/dev/zero of=/dev/sda bs=1M', 'ask-dd-disk'],
    ['shutdown -h now', 'ask-power'],
    ['sudo reboot', 'ask-power'],
    ['halt', 'ask-power'],
  ];
  for (const [command, ruleId] of asked) {
    it(`${command} → ${ruleId}`, () => {
      const d = decideBashCommand(command);
      expect(d.action).toBe('ask');
      expect(d.ruleId).toBe(ruleId);
    });
  }
  it('fork 炸弹直拒（reject：恒无合法用途）', () => {
    const d = decideBashCommand(':(){ :|:& };:');
    expect(d.action).toBe('reject');
    expect(d.ruleId).toBe('reject-forkbomb');
  });
});

describe('规则表可编程（调用方自带表优先于默认表）', () => {
  it('自定义表命中则按自定义表裁决', () => {
    const custom: PermissionRule[] = [
      { id: 'deny-test', tool: 'Bash', matches: { command: '*test*' }, action: 'reject' },
    ];
    const d = decideBashCommand('pnpm test', custom);
    expect(d).toEqual({ action: 'reject', ruleId: 'deny-test' });
  });
  it('自定义表未命中回落默认表', () => {
    const custom: PermissionRule[] = [
      { id: 'other', tool: 'Bash', matches: { command: '*nope*' }, action: 'reject' },
    ];
    const d = decideBashCommand('rm -rf /', custom);
    expect(d.action).toBe('ask');
  });
  it('默认模式非空、id 唯一且全小写连字符形（审计口径）', () => {
    expect(DEFAULT_BASH_PATTERNS.length).toBeGreaterThan(0);
    const ids = DEFAULT_BASH_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });
});

describe('拒绝文案（agent 能照着改）', () => {
  it('含规则 id、动作与改道建议', () => {
    const text = formatGateRefusal('rm -rf /', { action: 'ask', ruleId: 'ask-rm-rf-root' });
    expect(text).toContain('ask-rm-rf-root');
    expect(text).toContain('rm -rf /');
    expect(text).toMatch(/confirm|review|replan/i);
  });
});

describe('门控 operations（F4：透传执行语义）', () => {
  const exec = vi.fn(async () => ({ exitCode: 0 }));
  const gated = buildGatedBashOperations({ exec }, { log: () => {} });
  const opts = {
    onData: () => {},
    signal: undefined,
    timeout: 30,
    env: { PATH: '/usr/bin' },
  };
  it('allow 原样委托本地 ops（含 timeout/env/signal）', async () => {
    await gated.exec('ls', '/tmp', opts);
    expect(exec).toHaveBeenCalledWith('ls', '/tmp', opts);
  });
  it('ask 抛拒绝（含规则 id），不调用本地 ops', async () => {
    await expect(gated.exec('rm -rf /', '/tmp', opts)).rejects.toThrow('ask-rm-rf-root');
    expect(exec).not.toHaveBeenCalledWith('rm -rf /', '/tmp', opts);
  });
  it('ask/reject 都落一行 gate 日志；allow 静默（非常态不征税）', async () => {
    const log = vi.fn();
    const g = buildGatedBashOperations({ exec }, { log });
    await g.exec('ls', '/tmp', opts);
    expect(log).not.toHaveBeenCalled();
    await expect(g.exec('rm -rf /', '/tmp', opts)).rejects.toThrow();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toContain('ask-rm-rf-root');
  });
});
