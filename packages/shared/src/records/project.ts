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
});
export type ProjectRecord = z.infer<typeof projectRecordSchema>;

/** 项目页分段开关 `Tasks | Files`（r1 §461 changelog/02 §3 文件浏览面：
 * tree?ref= / file?path=&ref= 读裸库，无检出要求）。 */
export const PROJECT_TABS = ['Tasks', 'Files'] as const;
