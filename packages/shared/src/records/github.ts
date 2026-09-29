// GitHub 认证连接面（spec 12 / #352 族，#359 G2-T1）——repo picker 数据面
// 封套单源。`GET /api/github/repos?q=` = server 代理 GitHub `GET /user/repos`
// （token 取自 github_connection 表 SecretBox 密文，仅在 server 出站边界的
// Authorization 头出现，永不进 wire 响应）。字段面 = spec 12 数据契约
// {id, owner, name, full_name, private}——GitHub repo 对象的最小投影，
// snake_case 保持上游同名（full_name/private），owner 平铺为 login 串。

import { z } from 'zod';

/** picker 单条仓库行（GitHub `GET /user/repos` 条目最小投影）。 */
export const githubRepoSummarySchema = z.object({
  id: z.number(),
  /** owner login（上游 `owner.login` 平铺面）。 */
  owner: z.string(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
});
export type GithubRepoSummary = z.infer<typeof githubRepoSummarySchema>;

/** `GET /api/github/repos?q=` 响应封套（q = full_name 大小写不敏感子串过滤，
 * server 端本地过滤 [设计]——上游 /user/repos 无查询参数面）。 */
export const githubReposResponseSchema = z.object({
  repos: z.array(githubRepoSummarySchema),
});
export type GithubReposResponse = z.infer<typeof githubReposResponseSchema>;

/** GitHub 连接认证族描述符（spec 12 / #361 G2-T4）：与 #231 订阅族
 * （records/provider.ts OAUTH_FAMILIES github-copilot）同 GitHub OAuth App
 * 端点，scope 加 repo（picker 需读私仓列表；read:user 供 GET /user 取
 * login）。不并入 OAUTH_FAMILIES：该表驱动 providers 页连接段渲染
 * （#222 死钮律），且落点语义不同——本族 callback 落 github_connection 行
 * （DAO = services/github-connection.ts），不建 provider 行。 */
export const GITHUB_CONNECTION_OAUTH = {
  authorizeUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  scope: 'read:user repo',
} as const;

/** `GET /api/teams/{id}/github/connection` 响应封套（#361 认证状态读面）：
 * 仅 login/scope——无 token/密文位（02 §8 凭证只写不读出 wire）。未连接 =
 * `{connected:false}`（login/scope 缺席）。 */
export const githubConnectionStatusSchema = z.object({
  connected: z.boolean(),
  login: z.string().optional(),
  scope: z.string().optional(),
});
export type GithubConnectionStatus = z.infer<typeof githubConnectionStatusSchema>;

// —— issue 读面（#446 / ADR 0005 读向；只读，不在 GitHub 留痕迹）——————————

/** issue 上的 label 最小投影（GitHub label 对象 {name, color, description?}
 * 的子集）。color = 归一后的 `#rrggbb`（server 服务面出线前单点归一，
 * normalizeGithubLabelColor——上游 6-hex 无 #、偶缺/畸形兜底默认色，故
 * wire 面非空且带 #，消费端不再各自防御）。 */
export const githubIssueLabelSchema = z.object({
  name: z.string(),
  color: z.string(),
});
export type GithubIssueLabel = z.infer<typeof githubIssueLabelSchema>;

/** issue 列表条目（GitHub `GET /repos/{o}/{r}/issues` 条目最小投影；
 * snake_case 字段保持上游同名——githubRepoSummarySchema 同律。PR 条目在
 * server lib 层按 `pull_request` 键滤除，不入本形状）。 */
export const githubIssueSummarySchema = z.object({
  number: z.number(),
  title: z.string(),
  state: z.enum(['open', 'closed']),
  labels: z.array(githubIssueLabelSchema),
});
export type GithubIssueSummary = z.infer<typeof githubIssueSummarySchema>;

/** issue 列表的状态过滤值域（GitHub `state` 参数同形三值）。 */
export const GITHUB_ISSUE_STATES = ['open', 'closed', 'all'] as const;
export const githubIssueStateSchema = z.enum(GITHUB_ISSUE_STATES);
export type GithubIssueState = z.infer<typeof githubIssueStateSchema>;

/** `GET /api/projects/{id}/github/issues?state=&page=` 响应封套（#446）：
 * page 从 1 起；hasMore 取上游 Link 头 rel="next"（server lib 层判定）。 */
export const githubIssuesResponseSchema = z.object({
  issues: z.array(githubIssueSummarySchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});
export type GithubIssuesResponse = z.infer<typeof githubIssuesResponseSchema>;

/** `POST /api/projects/{id}/github/issues/import` body（#446）：选中一条
 * issue 建任务——server 现拉 issue 详情（不缓存第二真值，ADR 0005
 * premortem 护栏），响应 = 201 全 TodoRecord。 */
export const importGithubIssueBodySchema = z.object({
  number: z.number().int().positive(),
});
export type ImportGithubIssueBody = z.infer<typeof importGithubIssueBodySchema>;
