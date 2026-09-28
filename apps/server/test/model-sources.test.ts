// model-sources 端点对拍（spec 11 §A3/A4 + 数据契约，#356）：
// GET /api/teams/:id/model-sources → { sources: [pi, claude-code] } 恰两段——
// pi 段 = custom providers models[] 投影（installed 恒 true，server 在跑即
// pacman 自有 runtime 可用）；claude-code 段 = server 端 fs 直读
// ~/.claude/settings.json（model + env.ANTHROPIC_*_MODEL 槽），文件缺失/
// 解析失败 → installed:false，不空报不崩。每次 GET 重读文件（无缓存），
// 页面「实时反映 settings.json」语义由此承载。
// homeDir 是服务层注入位：路由生产态缺省 os.homedir()，测试注入 mkdtemp 目录。

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { modelSourcesEnvelopeSchema } from '@pacman/shared';
import { afterEach, describe, expect, test } from 'vitest';
import { getModelSources } from '../src/services/providers.js';
import { bootServer, req, type TestServer } from './helpers.js';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanups.splice(0)) fn();
});

function tmpHome(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pacman-model-sources-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeSettings(home: string, content: string): void {
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'settings.json'), content);
}

function modelSourcesPath(s: TestServer): string {
  return `/api/teams/${s.team.id}/model-sources`;
}

async function postProvider(s: TestServer): Promise<void> {
  const res = await req(s.app, 'POST', `/api/teams/${s.team.id}/providers`, {
    providerId: 'gw-test',
    label: '测试网关',
    baseUrl: 'https://gw.example.com/v1',
    api: 'openai-completions',
    models: [
      { id: 'model-a', name: '模型甲' },
      { id: 'model-b', name: '模型乙' },
    ],
  });
  expect(res.status).toBe(201);
}

describe('getModelSources（服务层，homeDir 注入）', () => {
  test('全新库：恰 pi + claude-code 两段，pi.models 空，封套过 shared schema', () => {
    const s = bootServer();
    const env = getModelSources({ db: s.db, box: s.secretBox }, s.team.id, tmpHome());
    expect(modelSourcesEnvelopeSchema.safeParse(env).success).toBe(true);
    expect(env.sources.map((src) => src.runtime)).toEqual(['pi', 'claude-code']);
    const pi = env.sources.find((src) => src.runtime === 'pi');
    expect(pi?.installed).toBe(true);
    expect(pi?.hostname).toBe(hostname());
    expect(pi?.models).toEqual([]);
  });

  test('pi 段 = custom providers models[] 投影（id/name 原样，跨 provider 平铺）', async () => {
    const s = bootServer();
    await postProvider(s);
    const env = getModelSources({ db: s.db, box: s.secretBox }, s.team.id, tmpHome());
    const pi = env.sources.find((src) => src.runtime === 'pi');
    expect(pi?.models).toEqual([
      { id: 'model-a', name: '模型甲' },
      { id: 'model-b', name: '模型乙' },
    ]);
  });

  test('claude-code：settings.json 缺失 → installed:false + models 空', () => {
    const s = bootServer();
    const env = getModelSources({ db: s.db, box: s.secretBox }, s.team.id, tmpHome());
    const cc = env.sources.find((src) => src.runtime === 'claude-code');
    expect(cc?.installed).toBe(false);
    expect(cc?.models).toEqual([]);
    expect(cc?.hostname).toBe(hostname());
  });

  test('claude-code：model + env.ANTHROPIC_*_MODEL 槽解析（中段小写化）', () => {
    const s = bootServer();
    const home = tmpHome();
    writeSettings(
      home,
      JSON.stringify({
        model: 'claude-opus-4-5',
        env: {
          ANTHROPIC_OPUS_MODEL: 'claude-opus-4-1',
          ANTHROPIC_SMALL_FAST_MODEL: 'claude-haiku-4-5',
          ANTHROPIC_BASE_URL: 'https://not-a-model-slot.example.com',
        },
      }),
    );
    const env = getModelSources({ db: s.db, box: s.secretBox }, s.team.id, home);
    const cc = env.sources.find((src) => src.runtime === 'claude-code');
    expect(cc?.installed).toBe(true);
    expect(cc?.models).toEqual([
      { id: 'claude-opus-4-5', name: 'claude-opus-4-5', slot: 'default' },
      { id: 'claude-opus-4-1', name: 'claude-opus-4-1', slot: 'opus' },
      { id: 'claude-haiku-4-5', name: 'claude-haiku-4-5', slot: 'small-fast' },
    ]);
  });

  test('claude-code：非法 JSON → installed:false（不抛）；非对象 JSON 同律', () => {
    const s = bootServer();
    const badJson = tmpHome();
    writeSettings(badJson, '{ not json');
    let cc = getModelSources({ db: s.db, box: s.secretBox }, s.team.id, badJson).sources.find(
      (src) => src.runtime === 'claude-code',
    );
    expect(cc?.installed).toBe(false);

    const arrayJson = tmpHome();
    writeSettings(arrayJson, '["claude-opus-4-5"]');
    cc = getModelSources({ db: s.db, box: s.secretBox }, s.team.id, arrayJson).sources.find(
      (src) => src.runtime === 'claude-code',
    );
    expect(cc?.installed).toBe(false);
  });

  test('claude-code：槽值非字符串/空串跳过该槽，installed 仍 true', () => {
    const s = bootServer();
    const home = tmpHome();
    writeSettings(
      home,
      JSON.stringify({
        model: '',
        env: { ANTHROPIC_OPUS_MODEL: 42, ANTHROPIC_SONNET_MODEL: 'claude-sonnet-5' },
      }),
    );
    const cc = getModelSources({ db: s.db, box: s.secretBox }, s.team.id, home).sources.find(
      (src) => src.runtime === 'claude-code',
    );
    expect(cc?.installed).toBe(true);
    expect(cc?.models).toEqual([
      { id: 'claude-sonnet-5', name: 'claude-sonnet-5', slot: 'sonnet' },
    ]);
  });

  test('每次调用重读文件：改 settings.json 后内容立即反映（实时语义）', () => {
    const s = bootServer();
    const home = tmpHome();
    writeSettings(home, JSON.stringify({ model: 'claude-opus-4-5' }));
    const deps = { db: s.db, box: s.secretBox };
    const before = getModelSources(deps, s.team.id, home).sources.find(
      (src) => src.runtime === 'claude-code',
    );
    writeSettings(home, JSON.stringify({ model: 'claude-sonnet-5' }));
    const after = getModelSources(deps, s.team.id, home).sources.find(
      (src) => src.runtime === 'claude-code',
    );
    expect(before?.models[0]?.id).toBe('claude-opus-4-5');
    expect(after?.models[0]?.id).toBe('claude-sonnet-5');
  });
});

describe('GET /api/teams/:id/model-sources（路由面）', () => {
  test('未知 team → 404 error 形', async () => {
    const s = bootServer();
    const res = await req(s.app, 'GET', '/api/teams/nope/model-sources');
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['error']);
  });

  test('200：恰两段 + 元素形状（installed/hostname 机器相关位只钉类型）', async () => {
    const s = bootServer();
    await postProvider(s);
    const res = await req(s.app, 'GET', modelSourcesPath(s));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sources: { runtime: string; installed: boolean; hostname: string; models: unknown[] }[];
    };
    expect(modelSourcesEnvelopeSchema.safeParse(body).success).toBe(true);
    expect(body.sources.map((src) => src.runtime)).toEqual(['pi', 'claude-code']);
    const pi = body.sources.find((src) => src.runtime === 'pi');
    expect(pi?.models).toHaveLength(2);
    const cc = body.sources.find((src) => src.runtime === 'claude-code');
    expect(typeof cc?.installed).toBe('boolean');
    expect(typeof cc?.hostname).toBe('string');
    expect(cc?.hostname).not.toBe('');
  });
});
