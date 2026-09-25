// OAuth 握手业务面（#231：一族打通 = github-copilot；族表 = shared
// OAUTH_FAMILIES）。authorize = state 签发 + 授权 URL 拼装；callback =
// state 核销 + token 交换（lib/github.ts OAuth 面——GitHub 出站唯一缝，#223 先例并入）+ token 密封落 provider 行
// apiKeyCipher 槽（只写不读，02 §8——GET 投影永不带值）。
// state 纪律：随机 32 字符、TTL 30min（#243 人环余量：10min 在 M6 联调被
// handoff 间隔撞穿一次——登录/2FA/停顿都算人环）、单次核销（入册即删后交换，
// 防并发双消费）；returnOrigin 取自 authorize 请求的 Origin 头并随 state
// 绑定——callback 302 只回该 origin，token 永不出现在 redirect 参数里。

import { OAUTH_FAMILIES, type SecretBox } from '@pacman/shared';
import type { Db } from '../db/client.js';
import { exchangeOAuthCode, type FetchLike } from '../lib/github.js';
import { newRecordId } from '../lib/ids.js';
import { createProvider, openProviderKey, updateProvider } from './providers.js';

/** state 在册有效期 [设计]：人环余量——真人走 GitHub 授权页可能叠加登录、
 * 二次验证与中途停顿（#243：M6 联调实测 handoff 间隔 >10min 撞穿旧窗）。 */
export const OAUTH_STATE_TTL_MS = 30 * 60 * 1000;

export interface OAuthStateEntry {
  teamId: string;
  presetId: string;
  /** authorize 请求的 Origin 头（= web 面 origin；callback 302 回跳根）。 */
  origin: string;
  createdAt: number;
}

/** OAuth App client 凭证对（config env 读位；null = 未配置）。四处消费
 * （config/context/helpers/service）共此单源。 */
export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

export interface OAuthDeps {
  db: Db;
  box: SecretBox;
  states: Map<string, OAuthStateEntry>;
  /** 出站注入位（lib/github.ts OAuth 面；routes 缺省填 globalThis.fetch）。 */
  fetch: FetchLike;
  client: OAuthClientConfig | null;
}

/** 握手失败四族：unknown-family = 族表外 preset（authorize 404）；
 * not-configured = client 凭证未配（authorize 400）；bad-state = state
 * 缺/过期（callback 302 reason=state——过期时 entry 在册故带可信 origin，
 * 不在册时缺、routes 走相对回跳，#243）；exchange-failed = 上游交换败
 * （origin 已知，callback 302 error 回跳）。 */
export class OAuthFlowError extends Error {
  constructor(
    readonly reason: 'unknown-family' | 'not-configured' | 'bad-state' | 'exchange-failed',
    message: string,
    /** 已知可信回跳根（bad-state 仅过期形携带；不在册形缺）。 */
    readonly origin?: string,
  ) {
    super(message);
    this.name = 'OAuthFlowError';
  }
}

function familyOf(presetId: string) {
  return OAUTH_FAMILIES.find((f) => f.presetId === presetId);
}

/** 惰性清扫过期 state（签发时顺手，无定时器）。 */
function sweep(states: Map<string, OAuthStateEntry>): void {
  const now = Date.now();
  for (const [state, entry] of states) {
    if (now - entry.createdAt > OAUTH_STATE_TTL_MS) states.delete(state);
  }
}

/** authorize 签发：入册 state + 拼授权 URL（web 同页签跳转目标）。 */
export function startOAuthAuthorize(
  deps: OAuthDeps,
  input: { teamId: string; presetId: string; origin: string },
): { authorizationUrl: string } {
  const family = familyOf(input.presetId);
  if (!family) {
    throw new OAuthFlowError('unknown-family', `oauth family ${input.presetId} not found`);
  }
  if (!deps.client) {
    throw new OAuthFlowError(
      'not-configured',
      'oauth client not configured (set PACMAN_GITHUB_OAUTH_CLIENT_ID/PACMAN_GITHUB_OAUTH_CLIENT_SECRET)',
    );
  }
  sweep(deps.states);
  const state = newRecordId(32);
  deps.states.set(state, {
    teamId: input.teamId,
    presetId: input.presetId,
    origin: input.origin,
    createdAt: Date.now(),
  });
  const url = new URL(family.authorizeUrl);
  url.searchParams.set('client_id', deps.client.clientId);
  url.searchParams.set('redirect_uri', `${input.origin}/api/oauth/callback`);
  url.searchParams.set('scope', family.scope);
  url.searchParams.set('state', state);
  return { authorizationUrl: url.toString() };
}

/** 取 state 并入册核销（单次）；缺/过期 → bad-state（过期形带 entry.origin
 * 供 302 回跳——entry 在册即 origin 可信，#243）。 */
function consumeState(deps: OAuthDeps, state: string): OAuthStateEntry {
  const entry = deps.states.get(state);
  if (!entry) throw new OAuthFlowError('bad-state', `oauth state ${state} not found`);
  deps.states.delete(state);
  if (Date.now() - entry.createdAt > OAUTH_STATE_TTL_MS) {
    throw new OAuthFlowError('bad-state', `oauth state ${state} expired`, entry.origin);
  }
  return entry;
}

/** 用户在 provider 站拒绝授权（callback 带 error 无 code）：核销 state，
 * 回 origin 供 302 error=denied。 */
export function abortOAuthCallback(deps: OAuthDeps, state: string): { origin: string } {
  const entry = consumeState(deps, state);
  return { origin: entry.origin };
}

/** callback 收码：核销 state → 交换 token → 密封落 provider 行（建行或
 * 重密封既有行——重连语义 = 覆盖，不增行）。createdBy = seed 用户 id
 *（与表单建行同主语）。 */
export async function completeOAuthCallback(
  deps: OAuthDeps,
  input: { code: string; state: string; createdBy: string },
): Promise<{ origin: string; presetId: string }> {
  const entry = consumeState(deps, input.state);
  const family = familyOf(entry.presetId);
  if (!family || !deps.client) {
    // 签发后配置被撤/族表收窄：state 已核销，按交换失败回跳。
    throw new OAuthFlowError('exchange-failed', 'oauth family or client missing', entry.origin);
  }
  let token: string;
  try {
    token = await exchangeOAuthCode(deps.fetch, {
      tokenUrl: family.tokenUrl,
      clientId: deps.client.clientId,
      clientSecret: deps.client.clientSecret,
      code: input.code,
      redirectUri: `${entry.origin}/api/oauth/callback`,
    });
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    throw new OAuthFlowError('exchange-failed', why, entry.origin);
  }
  const keyDeps = { db: deps.db, box: deps.box };
  const existing = openProviderKey(keyDeps, entry.teamId, family.presetId);
  if (existing) {
    // 重连 = 重密封（02 §8 只写位三态之 string 覆盖）。
    updateProvider(keyDeps, entry.teamId, existing.row.id, { apiKey: token });
  } else {
    createProvider(keyDeps, {
      teamId: entry.teamId,
      createdBy: input.createdBy,
      body: {
        providerId: family.presetId,
        label: family.providerLabel,
        baseUrl: family.providerBaseUrl,
        api: family.providerApi,
        authHeader: true,
        models: [],
        apiKey: token,
      },
    });
  }
  return { origin: entry.origin, presetId: entry.presetId };
}
