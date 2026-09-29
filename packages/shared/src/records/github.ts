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
