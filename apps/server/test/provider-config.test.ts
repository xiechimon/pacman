// toProviderConfig runtime 身份分支（spec 17 A4，#622 失败方式 4 的 server 侧）：
// runtime 身份（claude-code）→ null——凭据机器本地（claude 登录或
// ANTHROPIC_API_KEY），server 无可代发之物，也不再凭空造 api_key 配置
//（旧行为 = `agent.provider ? {kind:'api_key', providerId}` 回退，claude-code
// 步拿着伪配置在 pi 后端炸 model not found）。
// 非 runtime 身份（custom provider id / null）回退语义逐字节不变（A4/blast
// radius：默认支零回归是被证明的——本文件钉死非 runtime 支原输出）。
// 失败方式枚举先于实现固化（AGENTS.md 测试规则 3）：
//   1. runtime 身份 + bundle 无 provider 行 → null（堵 machines.ts:1405 回退）
//   2. 非 runtime custom id + bundle 无 provider 行 → api_key 回退原语义不变
//   3. agent provider null → null 原语义不变
//   4. bundle provider 在位 → http 投影原语义不变（runtime 检查不拦 custom 行）
//   5. runtime 身份 + 老混合版本面（bundle 造出行）→ http 投影（bundle 优先，
//      server 侧不二判——daemon 侧 runtime 分支才是权威短路）

import { describe, expect, test } from 'vitest';
import type { StepCredentialBundle } from '../src/services/credentials.js';
import { toProviderConfig } from '../src/services/machines.js';

const BUNDLE: StepCredentialBundle['provider'] = {
  providerId: 'stub-gw',
  label: 'Stub Gateway',
  baseUrl: 'http://127.0.0.1:9/v1',
  api: 'openai-completions',
  authHeader: true,
  compat: {},
  apiKey: 'sk-stub',
  models: [{ id: 'stub-model', name: 'stub-model' }],
  modelId: 'stub-model',
};

describe('toProviderConfig（spec 17 A4：runtime 身份零 provider 下发）', () => {
  test('失败方式 1：runtime 身份（claude-code）+ 无 provider 行 → null', () => {
    expect(toProviderConfig(null, 'claude-code')).toBeNull();
  });

  test('失败方式 2：非 runtime custom id + 无 provider 行 → api_key 回退原语义', () => {
    expect(toProviderConfig(null, 'stub-gw')).toEqual({
      kind: 'api_key',
      providerId: 'stub-gw',
    });
  });

  test('失败方式 3：agent provider null → null 原语义', () => {
    expect(toProviderConfig(null, null)).toBeNull();
  });

  test('失败方式 4：bundle provider 在位 → http 投影原语义（含 apiKey 透传）', () => {
    expect(toProviderConfig(BUNDLE, null)).toEqual({
      kind: 'http',
      providerId: 'stub-gw',
      label: 'Stub Gateway',
      baseUrl: 'http://127.0.0.1:9/v1',
      api: 'openai-completions',
      authHeader: true,
      // #654：compat 原样透传（空对象 = 未设旋钮，daemon 物化时按无 compat
      // 处理——pi 端点探测默认，零行为漂移）。
      compat: {},
      models: [{ id: 'stub-model', name: 'stub-model' }],
      apiKey: 'sk-stub',
    });
  });

  test('失败方式 5：bundle 在位 + runtime 身份 → http 投影（bundle 优先级不动）', () => {
    // server 侧只堵回退支；bundle（custom provider 行解密成功）保持优先，
    // runtime 权威短路在 daemon runner（mixed-version 兼容面见 runner-runtime）。
    expect(toProviderConfig(BUNDLE, 'claude-code')?.kind).toBe('http');
  });
});
