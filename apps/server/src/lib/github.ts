// GitHub 出站薄桥（#231 OAuth token 交换面 + spec 12/#359 repo picker 认证
// 面）——server 唯一 github.com 出站消费位（对照既有缝：lib/git.ts = 系统
// git spawn 桥、services/mcp-face.ts = MCP sdk 桥）；业务语义（OAuth state
// 与建行）归 services/oauth.ts，本模块只做 HTTP + 错误映射。
//
// 认证 API 面（spec 12 / #359 repo picker 代理 + #446 issue 读面）：
// - GET api.github.com/user/repos → 连接用户仓库列表（Authorization: Bearer
//   <github_connection token>——token 只进头不进 URL，错误 message 只带 URL）
// - GET repos/{o}/{r}/issues(/n) + labels → issue 列表/单条/label 集（#446
//   读向，token 纪律同上位）
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

const API_HEADERS = {
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
  // GitHub 要求 UA；品牌串不引 shared（lib 层零依赖纪律），字面量即可。
  'user-agent': 'pacman-server',
} as const;

// OAuth form POST 的 UA（与 API_HEADERS 字面量同值；form 面只吃 accept/
// content-type/user-agent，不挂 REST 版本头）。
const USER_AGENT = 'pacman-server';

/** 出站错误 → HttpError 单点映射（映射表见文件头注释）。headers 参数 =
 * 认证面扩展位（Authorization 头；错误路径只消费 url，token 永不进 message）。
 * 带响应头读出位（#446 issue 列表的 Link rel="next" 分页判定）。 */
async function readJsonFull(
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string> = API_HEADERS,
): Promise<{ data: unknown; getHeader: (name: string) => string | null }> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw mapFetchThrow(url, err);
  }
  if (!res.ok) throw mapUpstreamStatus(url, res);
  try {
    return { data: await res.json(), getHeader: (name) => res.headers.get(name) };
  } catch {
    throw new HttpError(502, `github response not json: ${url}`);
  }
}

async function readJson(
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string> = API_HEADERS,
): Promise<unknown> {
  return (await readJsonFull(fetchImpl, url, headers)).data;
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

/** 认证面仓库条目（GitHub `GET /user/repos` 元素最小投影；camelCase =
 * lib 内部形，wire 封套（full_name/private snake_case）归 shared
 * githubReposResponseSchema，routes 层映射）。 */
export interface GithubUserRepo {
  id: number;
  /** owner login（上游 `owner.login` 平铺）。 */
  owner: string;
  name: string;
  fullName: string;
  isPrivate: boolean;
}

/** 认证面仓库列表单页条数 [设计]（GitHub per_page 上限即 100；picker 靠 q
 * 过滤收敛，分页归后续需要时再开）。 */
const USER_REPOS_PER_PAGE = 100;

/** 连接用户的仓库列表（spec 12 / #359 repo picker 数据源）。token 仅进
 * Authorization 头（never URL / 错误 message）；`sort=pushed` 近期活跃在前、
 * 单页 USER_REPOS_PER_PAGE——picker 的 q 过滤在 routes 层本地做
 * （上游 /user/repos 无查询参数面）。畸形条目（缺 id/name/full_name/
 * owner.login）跳过不入列。 */
export async function githubUserRepos(
  fetchImpl: FetchLike,
  token: string,
): Promise<GithubUserRepo[]> {
  const url = `https://api.github.com/user/repos?per_page=${USER_REPOS_PER_PAGE}&sort=pushed`;
  const data = await readJson(fetchImpl, url, {
    ...API_HEADERS,
    authorization: `Bearer ${token}`,
  });
  if (!Array.isArray(data)) {
    throw new HttpError(502, 'github user repos response not an array');
  }
  const repos: GithubUserRepo[] = [];
  for (const raw of data as Array<Record<string, unknown>>) {
    const owner = raw.owner as { login?: unknown } | null | undefined;
    if (
      typeof raw.id !== 'number' ||
      typeof raw.name !== 'string' ||
      typeof raw.full_name !== 'string' ||
      typeof owner?.login !== 'string'
    ) {
      continue;
    }
    repos.push({
      id: raw.id,
      owner: owner.login,
      name: raw.name,
      fullName: raw.full_name,
      isPrivate: raw.private === true,
    });
  }
  return repos;
}

/** 认证用户 login（`GET /user`；spec 12 / #361 connection 族 callback 的
 * github_connection.login 读面）。token 仅进 Authorization 头（never URL /
 * 错误 message）；应答缺 login → 502。 */
export async function githubUserLogin(fetchImpl: FetchLike, token: string): Promise<string> {
  const data = (await readJson(fetchImpl, 'https://api.github.com/user', {
    ...API_HEADERS,
    authorization: `Bearer ${token}`,
  })) as { login?: unknown };
  if (typeof data.login !== 'string' || data.login === '') {
    throw new HttpError(502, 'github user response missing login');
  }
  return data.login;
}

// —— issue 读面（#446 / ADR 0005 读向：只读，不在 GitHub 留痕迹）——————————
//
// 认证面三端点（token 仅进 Authorization 头，never URL / 错误 message）：
// - GET /repos/{owner}/{repo}/issues（列表；上游同径返回 PR——按条目
//   `pull_request` 键滤除）
// - GET /repos/{owner}/{repo}/issues/{n}（单条含 body；导入建任务的现拉面，
//   不缓存第二真值）
// - GET /repos/{owner}/{repo}/labels（仓库 label 集；镜像同步数据源）

/** GitHub label 最小投影（issue 上的 label 与仓库 label 集同形，一型两面；
 * description 不投影——tag 表无该列）。lib 内部形；color 上游 6-hex 无 #、
 * 偶缺 → null（归一归 services/tags.ts 消费面，wire 封套归 shared
 * githubIssueLabelSchema）。 */
export interface GithubLabel {
  name: string;
  color: string | null;
}

/** issue 列表条目（lib 内部形，snake→camel 不转——字段名皆单词无歧义；
 * wire 映射归 routes 层 githubIssuesResponseSchema）。 */
export interface GithubIssueSummary {
  number: number;
  title: string;
  /** 上游 issue state 二值（'all' 只是查询参数，不是条目态）。 */
  state: 'open' | 'closed';
  labels: GithubLabel[];
}

/** 单条 issue 详情（导入面：body 位在此，列表面不带）。 */
export interface GithubIssueDetail extends GithubIssueSummary {
  body: string | null;
}

/** issue 列表单页条数 [设计]（对话面 30 条足够翻页；上游上限 100）。 */
const ISSUES_PER_PAGE = 30;

/** label 单页上限 [设计]（真实仓库 label 罕见 >100；超限面归需要时再开）。 */
const LABELS_PER_PAGE = 100;

/** owner/repo 段出站编码（列值已过 isGithubRepoRef 闸，双保险）。 */
function repoPath(owner: string, repo: string): string {
  return `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function authHeaders(token: string): Record<string, string> {
  return { ...API_HEADERS, authorization: `Bearer ${token}` };
}

/** 上游 label 数组 → 最小投影（issue.labels 与 /labels 端点同形同律）：
 * 畸形条目（缺 name/空串）跳过；color 非串 → null。 */
function parseLabels(raw: unknown): GithubLabel[] {
  if (!Array.isArray(raw)) return [];
  const labels: GithubLabel[] = [];
  for (const entry of raw as Array<Record<string, unknown>>) {
    if (typeof entry?.name !== 'string' || entry.name === '') continue;
    labels.push({
      name: entry.name,
      color: typeof entry.color === 'string' ? entry.color : null,
    });
  }
  return labels;
}

/** 上游 issue 条目 → 最小投影；畸形（缺 number/title/state 值域外）返回
 * null 由调用面跳过（githubUserRepos 同律）。PR 条目（`pull_request` 键）
 * 同样 null——/issues 上游语义混发。 */
function projectIssue(raw: Record<string, unknown>): GithubIssueSummary | null {
  if (raw.pull_request !== undefined) return null;
  if (typeof raw.number !== 'number' || typeof raw.title !== 'string') return null;
  if (raw.state !== 'open' && raw.state !== 'closed') return null;
  return {
    number: raw.number,
    title: raw.title,
    state: raw.state,
    labels: parseLabels(raw.labels),
  };
}

/** 仓库 issue 列表（`GET /repos/{o}/{r}/issues`）。state = open|closed|all、
 * page 从 1 起（上游同名参数直透）；hasMore = Link 头 rel="next" 在否。
 * 应答非数组 → 502；畸形/PR 条目跳过。state 值域单源 = shared
 * GITHUB_ISSUE_STATES（service 层以 GithubIssueState 收口后传入；lib 层
 * 零依赖纪律不引 shared，此处字面量联合为同值投影）。 */
export async function githubRepoIssues(
  fetchImpl: FetchLike,
  token: string,
  owner: string,
  repo: string,
  opts: { state: 'open' | 'closed' | 'all'; page: number },
): Promise<{ issues: GithubIssueSummary[]; hasMore: boolean }> {
  const url =
    `https://api.github.com/${repoPath(owner, repo)}/issues` +
    `?state=${opts.state}&page=${opts.page}&per_page=${ISSUES_PER_PAGE}`;
  const { data, getHeader } = await readJsonFull(fetchImpl, url, authHeaders(token));
  if (!Array.isArray(data)) {
    throw new HttpError(502, 'github issues response not an array');
  }
  const issues: GithubIssueSummary[] = [];
  for (const raw of data as Array<Record<string, unknown>>) {
    const projected = projectIssue(raw);
    if (projected) issues.push(projected);
  }
  const link = getHeader('link');
  return { issues, hasMore: (link ?? '').includes('rel="next"') };
}

/** 单条 issue 详情（`GET /repos/{o}/{r}/issues/{n}`；导入面现拉）。畸形
 * 应答 → 502；上游 404（issue 不存在/私仓无权）经既有映射直透。 */
export async function githubRepoIssue(
  fetchImpl: FetchLike,
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GithubIssueDetail> {
  const url = `https://api.github.com/${repoPath(owner, repo)}/issues/${issueNumber}`;
  const data = (await readJson(fetchImpl, url, authHeaders(token))) as Record<string, unknown>;
  const projected = projectIssue(data);
  if (!projected) {
    throw new HttpError(502, `github issue response malformed: ${url}`);
  }
  return {
    ...projected,
    body: typeof data.body === 'string' ? data.body : null,
  };
}

/** 仓库 label 集（`GET /repos/{o}/{r}/labels`，单页 LABELS_PER_PAGE
 * [设计]）。应答非数组 → 502；畸形条目跳过。 */
export async function githubRepoLabels(
  fetchImpl: FetchLike,
  token: string,
  owner: string,
  repo: string,
): Promise<GithubLabel[]> {
  const url = `https://api.github.com/${repoPath(owner, repo)}/labels?per_page=${LABELS_PER_PAGE}`;
  const data = await readJson(fetchImpl, url, authHeaders(token));
  if (!Array.isArray(data)) {
    throw new HttpError(502, 'github labels response not an array');
  }
  return parseLabels(data);
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

/** token 交换应答（#361：granted scope 随 access_token 一并回——GitHub
 * OAuth App 的 token 应答带 scope 字段（逗号分隔 granted 面），订阅族不消费、
 * connection 族落 github_connection.scope 列）。 */
export interface OAuthTokenExchange {
  accessToken: string;
  /** 上游应答原样（缺字段 = ''）。 */
  scope: string;
}

/** 授权码 → access_token。错误映射（callback 路由把 502 族转译成 302 error
 * 回跳，services/oauth.ts）：fetch reject/超时 → 502 unreachable；上游非 ok
 * → 502 upstream <status>；200 缺 access_token → 502 no access_token。 */
export async function exchangeOAuthCode(
  fetchImpl: FetchLike,
  input: OAuthExchangeInput,
): Promise<OAuthTokenExchange> {
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
  const scope = (payload as { scope?: unknown }).scope;
  return { accessToken: token, scope: typeof scope === 'string' ? scope : '' };
}
