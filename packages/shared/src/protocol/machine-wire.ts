// 机器面 wire 层——02 §5 canonical 13 端点（MACHINE_ENDPOINTS 路径词表单源，
// r3 §1.6 bundle 静态提取）的请求/响应 zod schema。路径与字段名不改形状
// （02 §5.8 尾注）；HTTP 动词与载荷细形 r3 未逐一采集处 = [推断]/[设计]
// （04 §3 不判负口径），实现期重放补采后回写 02 §11 收紧。
// 认证（02 §8/§5.3）：机器面 = `Authorization: Bearer <machine token 64hex>`；
// enroll = `Authorization: Bearer <apiKey tds_48hex>`；token 服务端存哈希。

import { z } from 'zod';
import { modelUsageSchema, providerConfigSchema, toolCallRecordSchema } from '../agent-backend.js';
import { epochMs, recordId } from '../records/common.js';
import { machineRecordSchema } from '../records/machine.js';
import { messageRoleSchema } from '../records/message.js';
import { stepRecordSchema } from '../records/step.js';
import { machineJsonSchema } from './executor.js';

/** 机器面认证头词表（02 §8：apiKey/machine token 存哈希不入 SecretBox）。 */
export const MACHINE_AUTH_HEADER = 'authorization';
export const MACHINE_AUTH_SCHEME = 'Bearer';

// —— enroll（02 §5.2 路径二：--api-key --team 非交互注册）—————————————————————

/** POST /api/machine/enroll body [推断]（r3 §1.2 实测命令行形状
 * `--api-key <key> --team <teamId>`；--name 默认 hostname，r3 §1.1）。 */
export const machineEnrollBodySchema = z.object({
  teamId: recordId,
  /** tds start --name（缺省 = hostname）。 */
  name: z.string().optional(),
  /** CLI 版本（机器页 latestCliVersion 数据源，r5 §8）。 */
  cliVersion: z.string().optional(),
});
export type MachineEnrollBody = z.infer<typeof machineEnrollBodySchema>;

/** 响应 = machine.json 形状（r3 §1.3 实测 {machineId,token(64hex),teamId,
 * serverUrl}）；token 一次性下发（服务端只存哈希，02 §8）。重注册复用同一
 * machineId（r3 §1.2 实测，按 key/team 认机器 [推断]）。 */
export const machineEnrollResponseSchema = machineJsonSchema;
export type MachineEnrollResponse = z.infer<typeof machineEnrollResponseSchema>;

/** POST /api/machine/enroll/start（浏览器授权流，02 §5.2 路径一）——响应形状
 * [设计]（r3 未走通该路径）；web 侧授权页归 M5 接线。 */
export const machineEnrollStartBodySchema = z.object({
  teamId: recordId.optional(),
  name: z.string().optional(),
});
export const machineEnrollStartResponseSchema = z.object({
  enrollId: z.string(),
  /** 浏览器授权 URL（登录页授权团队，02 §5.2）。 */
  url: z.string(),
});

/** POST /api/machine/enroll/poll——status 词 [设计]。 */
export const machineEnrollPollBodySchema = z.object({ enrollId: z.string() });
export const machineEnrollPollResponseSchema = z.union([
  z.object({ status: z.literal('pending') }),
  z.object({ status: z.literal('authorized'), machine: machineJsonSchema }),
  z.object({ status: z.literal('expired') }),
]);

// —— me / presence / recover ————————————————————————————————————————————————

/** GET /api/machine/me → machine record（02 §6.2；机器页数据同源）。 */
export const machineMeResponseSchema = machineRecordSchema;

/** POST /api/machine/presence body [推断]（02 §5.4：presence 心跳并行失败、
 * 进程不退出；maxConcurrent 上报 = daemon 配置默认值 3，02 §2.5）。 */
export const machinePresenceBodySchema = z.object({
  maxConcurrent: z.number().int().positive().optional(),
  cliVersion: z.string().optional(),
});
export const machineOkResponseSchema = z.object({ ok: z.literal(true) });

/** POST /api/machine/recover → 本机 claimed 未收尾步集（02 §5.4 步 journal
 * 恢复的 server 侧真值；`[recover] no pending steps found` 行形 r3 §1.5）。
 * 动词 [推断]。 */
export const machineRecoverResponseSchema = z.object({
  steps: z.array(stepRecordSchema),
});
export type MachineRecoverResponse = z.infer<typeof machineRecoverResponseSchema>;

// —— tasks/claim（长轮询，节奏 ~75–76s，r3 §1.5/02 §5.4）—————————————————————

/** POST /api/machine/tasks/claim body [推断]（动词：长轮询有实证，POST 为
 * claim 语义惯用形）。 */
export const machineClaimBodySchema = z.object({
  /** 本机当前运行步数（并发上限门 = min(machine.maxConcurrent, 上报值)）。 */
  running: z.number().int().min(0).optional(),
});

/** claim 载荷（02 §4.2 三类步 + §5.7 生命周期行所需上下文）[设计]——
 * wire 未采（r3 无 claim 响应样本）；字段 = 主时序执行最小集，凭证不在此
 * （per-step 走 token/{stepId}，02 §5.4/§8）。 */
export const claimedStepSchema = z.object({
  step: stepRecordSchema,
  /** ≡ step.buildId（CONTEXT.md 实体等式；显式字段 = 02 §5.7 `for conv <uuid>`）。 */
  conversationId: recordId,
  /** 会话语义（02 §4.2/§5.7）：new session | continue session（合并轮/驳回
   * 重规划复用同 conv pi 会话）。sessionId = 引擎侧会话标识（done 回传）。 */
  session: z.object({
    action: z.enum(['new', 'continue']),
    sessionId: z.string().nullable(),
  }),
  todo: z.object({
    id: recordId,
    seqNum: z.number().int(),
    title: z.string(),
    spec: z.string(),
  }),
  project: z.object({ id: recordId, name: z.string() }),
  /** 执行 Agent（assignment 按步类取槽，02 §4.2/r5 §5）；null = 未指派
   * （不可执行，server 侧不派发 [设计]）。 */
  agent: z
    .object({
      id: recordId,
      displayName: z.string(),
      description: z.string().nullable(),
      provider: z.string().nullable(),
      modelId: z.string().nullable(),
      thinkingLevel: z.string().nullable(),
    })
    .nullable(),
});
export type ClaimedStep = z.infer<typeof claimedStepSchema>;

/** 响应：{step: null} = 长轮询超时空手（daemon 立即重发，节奏 ≈ hold 时长
 * ≈ 75s，r3 §1.5 实测）。 */
export const machineClaimResponseSchema = z.object({
  step: claimedStepSchema.nullable(),
});
export type MachineClaimResponse = z.infer<typeof machineClaimResponseSchema>;

// —— stream（wake SSE，02 §1.2/§5.4）————————————————————————————————————————

/** GET /api/machine/stream 事件（MACHINE_STREAM_EVENT_TYPES 载荷化 [推断]：
 * wake = 有新步可领，低延迟派发；shutdown = 服务端要求下线）。 */
export const machineStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('wake') }),
  z.object({ type: z.literal('shutdown') }),
]);
export type MachineStreamEvent = z.infer<typeof machineStreamEventSchema>;

// —— 步骤 journal 端点（02 §5.4 词表）———————————————————————————————————————

/** POST /api/machine/heartbeat/{stepId}——续活；响应 {ok:true} [推断]。 */
export const machineHeartbeatResponseSchema = machineOkResponseSchema;

/** POST /api/machine/tool/{stepId}——工具调用回传（live transcript 工具行；
 * 与 upload-urls 终稿按 toolCall id 幂等去重 [设计]）。body = toolCallRecord
 * [推断]（r3 §1.6 端点名 + transcript 工具行证据）。 */
export const machineToolBodySchema = toolCallRecordSchema;

/** GET /api/machine/token/{stepId}——per-step 凭证下发（02 §5.4/§8：模型
 * key + 托管 repo git 凭证，daemon 内存持有不落盘常驻）。响应形状 [设计]
 * （端点名 + git fetch 无凭证失败旁证，r3 §1.6）。 */
export const machineTokenResponseSchema = z.object({
  /** 该步 Agent 的 provider 配置（apiKey 内存态；SecretBox 解密面归 M2c，
   * 无 key 网关可留空 = r3 §2 表单语义）。 */
  provider: providerConfigSchema.nullable(),
  /** 托管 repo git 凭证（02 §3：per-step 注入；GitHub 形态归 M2b）。 */
  git: z
    .object({
      username: z.string(),
      password: z.string(),
    })
    .nullable(),
});
export type MachineTokenResponse = z.infer<typeof machineTokenResponseSchema>;

/** POST /api/machine/upload-urls/{stepId}——预签名产物上传（r3 §1.6 观测
 * 存在）；self-host 无对象存储 = server 自出一一次性 PUT URL [设计]。 */
export const machineUploadUrlsBodySchema = z.object({
  files: z.array(
    z.object({
      name: z.string(),
      size: z.number().int().min(0).optional(),
    }),
  ),
});
export const machineUploadUrlsResponseSchema = z.object({
  uploads: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      method: z.literal('PUT'),
      headers: z.record(z.string(), z.string()),
    }),
  ),
});
export type MachineUploadUrlsResponse = z.infer<typeof machineUploadUrlsResponseSchema>;

/** transcript 上传件（PUT upload url 的 body）[设计]：终稿消息行集，id 幂等
 * （工具行 id = toolCall id，与 tool/{stepId} live 回传去重）。 */
export const transcriptUploadSchema = z.object({
  stepId: recordId,
  messages: z.array(
    z.object({
      id: z.string(),
      role: messageRoleSchema,
      content: z.unknown(),
      createdAt: epochMs,
    }),
  ),
});
export type TranscriptUpload = z.infer<typeof transcriptUploadSchema>;

/** POST /api/machine/done/{stepId}——步骤收尾 body [推断]（02 §5.4 端点名；
 * status 词 = 步级失败无自动重跑语义的最小三值，02 §4.2）。 */
export const machineDoneBodySchema = z.object({
  status: z.enum(['success', 'failed', 'stopped']),
  errorMessage: z.string().optional(),
  /** pi 会话标识（continue session 复用面：合并轮/重规划轮，02 §4.2）。 */
  sessionId: z.string().optional(),
  /** per-model 用量（token_usage 记账，02 §6.2/r3 §3.8）。 */
  usage: z.array(modelUsageSchema).optional(),
  /** review 列位双键之一（02 §4.1/r5 §8）。 */
  hasChanges: z.boolean().optional(),
});
export type MachineDoneBody = z.infer<typeof machineDoneBodySchema>;
export const machineDoneResponseSchema = machineOkResponseSchema;

/** 词表外 [设计] 附加端点（wire diff 白名单化用，04 §1/§3 divergence 登记
 * 机制同族）：upload-urls 预签名的落地点——self-host 无对象存储，server 自出
 * 一次性 PUT URL。非协议面外扩：13 端点词表（MACHINE_ENDPOINTS）不改形状，
 * 本表逐条带登记理由；server 路由面对拍测试单源消费。 */
export const MACHINE_WIRE_EXTENSIONS = [
  {
    method: 'PUT',
    path: '/api/machine/upload/{uploadId}',
    reason: '[设计] upload-urls 预签名落地（self-host 无对象存储）；一次性 uploadId',
  },
] as const;

/** 机器面 wire 对拍表（04 §3：端点路径/动词/请求/响应形状逐字段进 CI）。
 * 路径单源 = MACHINE_ENDPOINTS（machine-api.ts）；本表 = 动词 + schema 面，
 * `{stepId}` 归一同 02 §6.1 记法。 */
export const MACHINE_WIRE = [
  {
    method: 'POST',
    path: '/api/machine/enroll',
    request: machineEnrollBodySchema,
    response: machineEnrollResponseSchema,
  },
  {
    method: 'POST',
    path: '/api/machine/enroll/start',
    request: machineEnrollStartBodySchema,
    response: machineEnrollStartResponseSchema,
  },
  {
    method: 'POST',
    path: '/api/machine/enroll/poll',
    request: machineEnrollPollBodySchema,
    response: machineEnrollPollResponseSchema,
  },
  { method: 'GET', path: '/api/machine/me', response: machineMeResponseSchema },
  {
    method: 'POST',
    path: '/api/machine/presence',
    request: machinePresenceBodySchema,
    response: machineOkResponseSchema,
  },
  { method: 'POST', path: '/api/machine/recover', response: machineRecoverResponseSchema },
  {
    method: 'POST',
    path: '/api/machine/tasks/claim',
    request: machineClaimBodySchema,
    response: machineClaimResponseSchema,
  },
  { method: 'GET', path: '/api/machine/stream', response: machineStreamEventSchema },
  {
    method: 'POST',
    path: '/api/machine/heartbeat/{stepId}',
    response: machineHeartbeatResponseSchema,
  },
  {
    method: 'POST',
    path: '/api/machine/tool/{stepId}',
    request: machineToolBodySchema,
    response: machineOkResponseSchema,
  },
  { method: 'GET', path: '/api/machine/token/{stepId}', response: machineTokenResponseSchema },
  {
    method: 'POST',
    path: '/api/machine/upload-urls/{stepId}',
    request: machineUploadUrlsBodySchema,
    response: machineUploadUrlsResponseSchema,
  },
  {
    method: 'POST',
    path: '/api/machine/done/{stepId}',
    request: machineDoneBodySchema,
    response: machineDoneResponseSchema,
  },
] as const;
