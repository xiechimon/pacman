// GitHub 出站薄桥（#231 OAuth token 交换面）——server 唯一 github.com 出站
// 消费位（对照既有缝：lib/git.ts = 系统 git spawn 桥、services/mcp-face.ts =
// MCP sdk 桥）；业务语义（OAuth state 与建行）归 services/oauth.ts，本模块
// 只做 HTTP + 错误映射。
//
// OAuth 面（#231 握手）：
// - POST github.com/login/oauth/access_token（form-encoded：client_id/
//   client_secret/code/redirect_uri，Accept: json）→ access_token
// （旧 #223 skills GitHub 扫描面已随 spec 13 #367 退役——技能改本地目录
// 现扫，repo info/tree/raw 三函数一并出账。）
// 代理注记：Node fetch 默认不吃 http_proxy/https_proxy 环境变量——部署面需
// 代理出站时以 `NODE_USE_ENV_PROXY=1` 启动 server（Node ≥24.5）。

import { HttpError } from './errors.js';

/** fetch 结构子集（测试注入 mock；globalThis.fetch 天然满足）。method/body
 * 位 = #231 OAuth form POST 所需。 */
export type FetchLike = (
  input: string | URL,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

/** 单请求超时 [设计]（token 交换外挂起不拖死 callback 回跳）。 */
const FETCH_TIMEOUT_MS = 15_000;

// GitHub 要求 UA；品牌串不引 shared（lib 层零依赖纪律），字面量即可。
const USER_AGENT = 'pacman-server';

// —— OAuth token 交换面（#231 握手：callback 收码后唯一一次出站）———————————

export interface OAuthExchangeInput {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  code: string;
  /** 与 authorize 期发出的 redirect_uri 同值（GitHub 校验一致）。 */
  redirectUri: string;
}

/** 授权码 → access_token。错误映射（callback 路由把 502 族转译成 302 error
 * 回跳，services/oauth.ts）：fetch reject/超时 → 502 unreachable；上游非 ok
 * → 502 upstream <status>；200 缺 access_token → 502 no access_token。 */
export async function exchangeOAuthCode(
  fetchImpl: FetchLike,
  input: OAuthExchangeInput,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    redirect_uri: input.redirectUri,
  }).toString();
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(input.tokenUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': USER_AGENT,
      },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    throw new HttpError(502, `oauth token exchange unreachable: ${why}`);
  }
  if (!res.ok) {
    throw new HttpError(502, `oauth token exchange upstream ${res.status}`);
  }
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new HttpError(502, 'oauth token exchange returned non-json');
  }
  const token = (payload as { access_token?: unknown }).access_token;
  if (typeof token !== 'string' || token === '') {
    throw new HttpError(502, 'oauth token exchange returned no access_token');
  }
  return token;
}
