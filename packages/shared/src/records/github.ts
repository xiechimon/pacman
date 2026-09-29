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
