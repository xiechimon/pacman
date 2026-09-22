// per-step 凭证下发接口面（02 §8 运行时层 + 02 §5.4 `/api/machine/token/{stepId}`
// 的服务端解析契约——HTTP 端点归 M3 机器面，本层先行；载荷细形 [推断]，
// wire 未采（r3 §1.6 仅端点名 + git fetch 无凭证失败旁证；r5 §3.1 relay 工具名
// `push_credential` 坐实 per-step 下发语义）。
// 纪律（02 §8）：明文只出现在返回值——executor 内存持有、不落盘常驻
// （[推断] r3 注记原样继承）；本层不落库、不写日志。
// 解析链：step → build → todo → assignment 执行侧槽 → agent → provider 行
// （按 providerId 寻址 [推断]，r3 §1.5 `using model <provider>/<modelId>` 同串）
// → SecretBox 解密；env = agent.secrets 授权集（records/agent.ts [推断] 关联
// secret id）→ 明文映射（02 §8：团队 Secret 注入任务 shell 环境变量）。

import type { ProviderApi, SecretBox } from '@pacman/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { agent, build, step, todo } from '../db/schema.js';
import { notFound } from '../lib/errors.js';
import { openProviderKey, type ProviderDeps } from './providers.js';
import { openSecretEnv, type SecretDeps } from './secrets.js';

export interface CredentialsDeps {
  db: Db;
  box: SecretBox;
}

/** 下发载荷 [推断]（02 §5.4 token 端点注 =「模型 key + 托管 repo git 凭证」；
 * git 槽待 M2b 托管 repo 面落地接线，当前恒 null）。 */
export interface StepCredentialBundle {
  /** 模型凭证（provider key 明文，内存 only）；null = 未指派 / provider 未配。 */
  provider: {
    providerId: string;
    label: string;
    baseUrl: string;
    api: ProviderApi;
    authHeader: boolean;
    /** 明文密钥；无密钥网关 = null（r3 §2「无密钥网关可留空」）。 */
    apiKey: string | null;
    /** Agent 侧选定模型（r3 §1.5 `using model <provider>/<modelId>`）。 */
    modelId: string | null;
  } | null;
  /** 团队 Secret → 任务 shell 环境变量（仅 agent 授权集，02 §8/r2 权限开关）。 */
  env: Record<string, string>;
  /** 托管 repo git 凭证槽（02 §5.4）；M2b git 面接线，当前恒 null。 */
  git: null;
}

export function resolveStepCredentials(
  deps: CredentialsDeps,
  stepId: string,
): StepCredentialBundle {
  const stepRow = deps.db.select().from(step).where(eq(step.id, stepId)).get();
  if (!stepRow) throw notFound(`step ${stepId}`);
  const buildRow = deps.db.select().from(build).where(eq(build.id, stepRow.buildId)).get();
  if (!buildRow) throw notFound(`build ${stepRow.buildId}`);
  const todoRow = deps.db.select().from(todo).where(eq(todo.id, buildRow.todoId)).get();
  if (!todoRow) throw notFound(`todo ${buildRow.todoId}`);

  // 执行侧优先（build 槽），规划步回退 plan 槽（02 §4.2 双槽分派，r5 §5）。
  const agentId = todoRow.assignment?.build?.agentId ?? todoRow.assignment?.plan?.agentId ?? null;
  const agentRow = agentId ? deps.db.select().from(agent).where(eq(agent.id, agentId)).get() : null;

  const boxDeps: ProviderDeps & SecretDeps = deps;
  let provider: StepCredentialBundle['provider'] = null;
  if (agentRow?.provider) {
    const opened = openProviderKey(boxDeps, todoRow.teamId, agentRow.provider);
    if (opened) {
      provider = {
        providerId: opened.row.providerId,
        label: opened.row.label,
        baseUrl: opened.row.baseUrl,
        api: opened.row.api,
        authHeader: opened.row.authHeader,
        apiKey: opened.apiKey,
        modelId: agentRow.modelId,
      };
    }
  }

  // 未指派 Agent = 无注入面（secrets 开关是 per-Agent 授权，r2 权限 tab）。
  const env = agentRow ? openSecretEnv(boxDeps, todoRow.teamId, agentRow.secrets) : {};

  return { provider, env, git: null };
}
