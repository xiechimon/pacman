// git.ts 凭证注入单测（02 §8 per-step 凭证不落盘 + credential.helper 空值重置
// 契约）。功能面用真 `git credential fill` 复现：全局 helper 返回陈旧密码时，
// gitCredentialEnv 的空值重置使内联 fresh 密码胜出——平台无关回归护栏
// （integration demo 仅在带 osxkeychain 的 macOS 才自然复现该叠加）。

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { gitCredentialEnv } from '../src/git.js';

const CRED = { username: 'git', password: 'tds_fresh_token_123' };

describe('gitCredentialEnv — per-step 凭证 env 注入（02 §8 不落盘）', () => {
  test('前置空值 credential.helper 重置系统/全局 helper 列表', () => {
    const env = gitCredentialEnv(CRED);
    // 重置条目须在首位：空值清空此前系统级/全局累积的全部 helper（如
    // osxkeychain），否则同主机陈旧（已撤销）token 被优先命中 → auth 失败，
    // 且成功轮会回写钥匙串（凭证落盘面，破 02 §8 不落盘纪律）。
    expect(env.GIT_CONFIG_COUNT).toBe('2');
    expect(env.GIT_CONFIG_KEY_0).toBe('credential.helper');
    expect(env.GIT_CONFIG_VALUE_0).toBe('');
    // 本步唯一凭证来源 = 内联 helper（echo username/password）。
    expect(env.GIT_CONFIG_KEY_1).toBe('credential.helper');
    expect(env.GIT_CONFIG_VALUE_1).toContain(`username=${CRED.username}`);
    expect(env.GIT_CONFIG_VALUE_1).toContain(`password=${CRED.password}`);
    // 交互提示关闭（无 tty 挂起护栏）。
    expect(env.GIT_TERMINAL_PROMPT).toBe('0');
  });

  test('空值重置使内联凭证压过全局 helper（真 git credential fill）', () => {
    const home = mkdtempSync(join(tmpdir(), 'pacman-git-cred-'));
    // 全局 helper（绝对路径）恒返回 STALE——等价 osxkeychain 命中陈旧凭证。
    const staleHelper = join(home, 'stale-helper.sh');
    writeFileSync(staleHelper, '#!/bin/sh\necho username=git\necho password=STALE_REVOKED\n');
    chmodSync(staleHelper, 0o755);
    writeFileSync(join(home, '.gitconfig'), `[credential]\n\thelper = ${staleHelper}\n`);

    const res = spawnSync('git', ['credential', 'fill'], {
      input: 'protocol=http\nhost=127.0.0.1:1\n\n',
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: home,
        GIT_CONFIG_NOSYSTEM: '1', // 隔离 Xcode 系统 gitconfig（同样含 osxkeychain）
        ...gitCredentialEnv(CRED),
      },
    });
    const out = res.stdout ?? '';
    // 内联 fresh 凭证胜出；陈旧全局 helper 被空值重置清除，不参与填充。
    expect(out).toContain(`password=${CRED.password}`);
    expect(out).not.toContain('STALE_REVOKED');
  });
});
