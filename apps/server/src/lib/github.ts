// GitHub 出站薄桥（#223：skills 扫描发现半，#201 裁决路线 A；#231 OAuth
// token 交换面并入——github.com/login/oauth 同族出站）——server 唯一 GitHub
// 出站消费位（对照既有缝：lib/git.ts = 系统 git spawn 桥、services/
// mcp-face.ts = MCP sdk 桥）；业务语义（候选发现/文件集组装/OAuth state
// 与建行）归 services/{skills,oauth}.ts，本模块只做 HTTP + 错误映射。
//
// API 面（无 auth 起步——公开仓）：
// - GET api.github.com/repos/{owner}/{repo}          → default_branch（2 次 REST/scan 之一）
// - GET api.github.com/repos/{o}/{r}/git/trees/{branch}?recursive=1 → 全树（含 blob size）
// - GET raw.githubusercontent.com/{o}/{r}/{branch}/{path} → 文件原文（CDN，不占 REST 配额）
// OAuth 面（#231 握手）：
// - POST github.com/login/oauth/access_token（form-encoded：client_id/
//   client_secret/code/redirect_uri，Accept: json）→ access_token
// Rate limit 注记：未认证 REST = 60 req/h/IP（每次 scan/fetch 用 2 次：repo info
// + tree）；raw 走 CDN 不计。限流两形 → 429：403 + x-ratelimit-remaining:0
// （主限额）、403 + retry-after（二级/abuse 限额）。
// 代理注记：Node fetch 默认不吃 http_proxy/https_proxy 环境变量——部署面需
// 代理出站时以 `NODE_USE_ENV_PROXY=1` 启动 server（Node ≥24.5；本地实测
// raw.githubusercontent.com 直连被掐时代理即通）。
// 已知限制 [设计]：branch 名含 `/` 时 raw URL ref/path 分界歧义（默认分支
// 实际极少含斜杠），首版不处理。
//
// 错误映射（{error} 单形状词汇表内新增 429/502 两码——上游语义需要）：
// - repo info 404            → 404（私仓无 auth 与不存在同形，GitHub 语义原样）
// - 403 + remaining=0 / 429  → 429（限流；客户端可据此提示重试）
// - trees 409                → 502（空 repo：GitHub "Git Repository is empty."）
// - 上游 5xx / 其它非 ok     → 502
// - fetch reject（网络断）   → 502；AbortSignal.timeout → 502（message 带 timeout）
// - raw 404                  → null 返回（调用方决定跳过/报错——race 语义）

import { HttpError } from './errors.js';

/** fetch 结构子集（测试注入 mock；globalThis.fetch 天然满足）。method/body
 * 位 = #231 OAuth form POST 所需（REST 面全 GET 不填）。 */
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

/** 单请求超时 [设计]（树/文件任一站外挂起不拖死请求面）。 */
const FETCH_TIMEOUT_MS = 15_000;

const API_HEADERS = {
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
  // GitHub 要求 UA；品牌串不引 shared（lib 层零依赖纪律），字面量即可。
  'user-agent': 'pacman-server',
} as const;

export interface GithubRepoInfo {
  defaultBranch: string;
}

export interface GithubTreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit' | (string & {}); // 已知三值，留扩展位
  size?: number; // blob 专属
}

export interface GithubTree {
  entries: GithubTreeEntry[];
  truncated: boolean;
}

/** 出站错误 → HttpError 单点映射（映射表见文件头注释）。 */
async function readJson(fetchImpl: FetchLike, url: string): Promise<unknown> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(url, {
      headers: API_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw mapFetchThrow(url, err);
  }
  if (!res.ok) throw mapUpstreamStatus(url, res);
  try {
    return await res.json();
  } catch {
    throw new HttpError(502, `github response not json: ${url}`);
  }
}

function mapFetchThrow(url: string, err: unknown): HttpError {
  if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return new HttpError(502, `github fetch timeout after ${FETCH_TIMEOUT_MS}ms: ${url}`);
  }
  if (err instanceof TypeError) {
    // undici 把底层原因挂 cause（ECONNRESET/ENOTFOUND…）——带上便于定位。
    const cause = (err as { cause?: { code?: string } }).cause?.code;
    return new HttpError(
      502,
      `github fetch network error: ${err.message}${cause ? ` (${cause})` : ''}: ${url}`,
    );
  }
  return new HttpError(502, `github fetch failed: ${String(err)}: ${url}`);
}

function mapUpstreamStatus(
  url: string,
  res: { status: number; headers: { get(n: string): string | null } },
): HttpError {
  if (res.status === 404) {
    // 私仓无 auth 与不存在同形（GitHub 防探测语义），不区分。
    return new HttpError(404, `github repo not found (or private without auth): ${url}`);
  }
  if (
    res.status === 429 ||
    (res.status === 403 &&
      (res.headers.get('x-ratelimit-remaining') === '0' ||
        // 二级限流（abuse/secondary）：403 无 remaining 头、带 retry-after。
        res.headers.get('retry-after') !== null))
  ) {
    return new HttpError(
      429,
      'github api rate limit exceeded (unauthenticated 60 req/h per IP); retry later',
    );
  }
  if (res.status === 409) {
    return new HttpError(502, `github repo is empty (no commits): ${url}`);
  }
  return new HttpError(502, `github api ${res.status}: ${url}`);
}

/** repo 元信息（default_branch 消费位；响应体其余字段不读）。 */
export async function githubRepoInfo(fetchImpl: FetchLike, repo: string): Promise<GithubRepoInfo> {
  const data = (await readJson(fetchImpl, `https://api.github.com/repos/${repo}`)) as {
    default_branch?: unknown;
  };
  if (typeof data.default_branch !== 'string' || data.default_branch === '') {
    throw new HttpError(502, `github repo info missing default_branch: ${repo}`);
  }
  return { defaultBranch: data.default_branch };
}

/** 递归全树（blob 含 size——fetch 模式容量闸先知，不发无效 raw）。 */
export async function githubRepoTree(
  fetchImpl: FetchLike,
  repo: string,
  branch: string,
): Promise<GithubTree> {
  const data = (await readJson(
    fetchImpl,
    `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  )) as { tree?: unknown; truncated?: unknown };
  if (!Array.isArray(data.tree)) {
    throw new HttpError(502, `github tree response missing tree array: ${repo}`);
  }
  const entries: GithubTreeEntry[] = [];
  for (const raw of data.tree as Array<Record<string, unknown>>) {
    if (typeof raw.path !== 'string' || typeof raw.type !== 'string') continue;
    entries.push({
      path: raw.path,
      type: raw.type,
      ...(typeof raw.size === 'number' ? { size: raw.size } : {}),
    });
  }
  return { entries, truncated: data.truncated === true };
}

/** raw 文件原文（CDN 面，不占 REST 配额）；404 → null（race 语义归调用方）。 */
export async function githubRawFile(
  fetchImpl: FetchLike,
  repo: string,
  branch: string,
  path: string,
): Promise<string | null> {
  const encodedPath = path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const url = `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${encodedPath}`;
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    throw mapFetchThrow(url, err);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw mapUpstreamStatus(url, res);
  return res.text();
}

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
        'user-agent': API_HEADERS['user-agent'],
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
