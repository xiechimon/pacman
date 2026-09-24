// project record——02 §6.1（projects?teamId= / projects/{id}/* 端点族）+
// 01 §6 表注「repo 形态字段：托管 bare / GitHub 接入（02 §3/A4）」。
// wire 形状未实测（r2 §1.5 projects 缓存为空数组样本），以下为最小投影：
// id/name/teamId 有据（schedules 内嵌 todo.projectName、?teamId= 查询、
// branches/tags/todos 子资源），repo 形态字段按 02 §3 双形态逆推 [推断]，
// M2 实现期展开。

import { z } from 'zod';
import { recordId } from './common.js';

/** repo 双形态（02 §3/A4 锁定）：托管 = server 自带本地 bare repo
 * （git http-backend）；接入 = GitHub（PR/CI 面）。wire 值 [推断] 可改判。 */
export const PROJECT_REPO_KINDS = ['hosted', 'github'] as const;
export const projectRepoKindSchema = z.enum(PROJECT_REPO_KINDS);

export const projectRecordSchema = z.object({
  id: recordId,
  name: z.string(),
  teamId: recordId,
  /** repo 形态（02 §3）；字段名/值 [推断]。GitHub 接入侧连号授权、
   * executor push conv 分支、建 PR、读 PR/issues/CI workflow runs。 */
  repoKind: projectRepoKindSchema.optional(),
  // —— M2b repo 形态展开（本 schema 头注「M2 实现期展开」的落地；皆 [推断]，
  // wire 补采后收紧，04 附录 A）——
  /** 托管 repo 名段：远端 URL `<host>/<teamId>/<repoName>`（r3 §1.4 daemon.log
   * `Cloning <teamId>/r3-lifecycle` 实测形状；值 = 项目名 slug [设计]）。 */
  repoName: z.string().optional(),
  /** GitHub 接入 `owner/repo`（02 §3 接入形态；字段名 [推断]）。 */
  githubRepo: z.string().optional(),
  /** clone URL（「Git 复制检出命令」卡数据源，02 §9.3）。托管 = 本地主机代位
   * （02 §5.8 gitHostDomain 槽）；github = github.com 派生 [设计]。 */
  cloneUrl: z.string().optional(),
});
export type ProjectRecord = z.infer<typeof projectRecordSchema>;

/** 项目页分段开关 `Tasks | Files`（r1 §461 changelog/02 §3 文件浏览面：
 * tree?ref= / file?path=&ref= 读裸库，无检出要求）。 */
export const PROJECT_TABS = ['Tasks', 'Files'] as const;

// —— 文件浏览面响应封套（r3 §8.2 端点存在实测、载荷未采；形状 [推断]，
// 04 附录 A 补采后收紧）————————————————————————————————————————————

/** `GET /api/projects/{id}/tree?ref=` 响应（02 §3 读裸库 ref 树）。 */
export const projectTreeResponseSchema = z.object({
  /** 请求 ref 回显（缺省 `HEAD`）。 */
  ref: z.string(),
  /** 解析后的 commit sha（ref 不存在 = 404 {error}）。 */
  commit: z.string(),
  path: z.string(),
  entries: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      type: z.enum(['blob', 'tree']),
      /** blob 字节数；tree 为 null（ls-tree -l 语义）。 */
      size: z.number().int().nullable(),
    }),
  ),
});
export type ProjectTreeResponse = z.infer<typeof projectTreeResponseSchema>;

/** `GET /api/projects/{id}/file?path=&ref=` 响应（02 §3 读单文件）。 */
export const projectFileResponseSchema = z.object({
  ref: z.string(),
  commit: z.string(),
  path: z.string(),
  size: z.number().int(),
  /** 二进制判定（首 8KB 含 NUL，git 同款启发式 [设计]）→ base64。 */
  encoding: z.enum(['utf-8', 'base64']),
  content: z.string(),
});
export type ProjectFileResponse = z.infer<typeof projectFileResponseSchema>;

/** `GET /api/projects/{id}/branches` 响应（「分支与 PR」区数据面，02 §9.3；
 * PR 卡语义仅 GitHub-backed（r3 §3.9 [推断]），PR 读面依赖 GitHub API 归 M3+）。 */
export const projectBranchesResponseSchema = z.object({
  defaultBranch: recordId.nullable(),
  branches: z.array(
    z.object({
      name: z.string(),
      isDefault: z.boolean(),
    }),
  ),
});
export type ProjectBranchesResponse = z.infer<typeof projectBranchesResponseSchema>;

/** `GET /api/projects/{id}/commits` 响应（#149 项目页 文件|历史 分段的
 * 「历史」数据源；wire 未采，[推断] 读面——路径 = projects/{id}/… REST
 * 同族规则（tree/branches 先例），行形 = git log 最小投影，新→旧序）。 */
export const projectCommitsResponseSchema = z.object({
  /** 解析的 ref 回显（缺省 = 默认分支）。 */
  ref: z.string(),
  commits: z.array(
    z.object({
      sha: z.string(),
      shortSha: z.string(),
      /** 提交标题行（git log %s 同义）。 */
      message: z.string(),
      authorName: z.string(),
      /** 作者时间 epoch ms（git log %aI 解析）。 */
      at: z.number(),
    }),
  ),
});
export type ProjectCommitsResponse = z.infer<typeof projectCommitsResponseSchema>;
