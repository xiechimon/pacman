// 机器面 wire 层——02 §5 canonical 13 端点（MACHINE_ENDPOINTS 路径词表单源，
// r3 §1.6 bundle 静态提取）的请求/响应 zod schema。路径与字段名不改形状
// （02 §5.8 尾注）；HTTP 动词与载荷细形 r3 未逐一采集处 = [推断]/[设计]
// （04 §3 不判负口径），实现期重放补采后回写 02 §11 收紧。
// 认证（02 §8/§5.3）：机器面 = `Authorization: Bearer <machine token 64hex>`；
// enroll = `Authorization: Bearer <apiKey pacman_48hex>`（前缀 = brand.ts
// apiKeyPrefix 槽）；token 服务端存哈希。

import { z } from 'zod';
import {
  mcpEndpointSchema,
  modelUsageSchema,
  providerConfigSchema,
  toolCallRecordSchema,
} from '../agent-backend.js';
import { epochMs, recordId } from '../records/common.js';
import { machineRecordSchema } from '../records/machine.js';
import { messageRoleSchema } from '../records/message.js';
import { stepRecordSchema } from '../records/step.js';
import {
  machineToolRelayBodySchema,
  machineToolRelayResponseSchema,
  remoteToolDefSchema,
} from './chief-tools.js';
import { machineJsonSchema } from './executor.js';

/** 机器面认证头词表（02 §8：apiKey/machine token 存哈希不入 SecretBox）。 */
export const MACHINE_AUTH_HEADER = 'authorization';
export const MACHINE_AUTH_SCHEME = 'Bearer';

// —— enroll（02 §5.2 路径二：--api-key --team 非交互注册）—————————————————————

/** POST /api/machine/enroll body [推断]（r3 §1.2 实测命令行形状
 * `--api-key <key> --team <teamId>`；--name 默认 hostname，r3 §1.1）。 */
export const machineEnrollBodySchema = z.object({
  teamId: recordId,
  /** pacman start --name（缺省 = hostname）。 */
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
 * （per-step 走 token/{stepId}，02 §5.4/§8）。
 * M4a 扩展（chief 步，r5 §3.1 实测 Chief 回合 = 机器 step）：`remoteTools[]`
 * 位形一手 = bundle `makeRemoteTools(serverUrl, token, step)` 读
 * `step.remoteTools`（r5 §3.1 raw 提取）；`chief` 块与 `instruction` 为
 * [设计] 等价物（wire 未采）。 */
export const claimedStepSchema = z.object({
  step: stepRecordSchema,
  /** ≡ step.buildId（CONTEXT.md 实体等式；显式字段 = 02 §5.7 `for conv <uuid>`）。
   * chief 步 = `chief-<uuid>`（conversationId ≡ threadId，r5 §3.1）。 */
  conversationId: recordId,
  /** 会话语义（02 §4.2/§5.7）：new session | continue session（合并轮/驳回
   * 重规划/chief 续轮复用同 conv pi 会话）。sessionId = 引擎侧会话标识（done 回传）。 */
  session: z.object({
    action: z.enum(['new', 'continue']),
    sessionId: z.string().nullable(),
  }),
  /** 续轮指令（server 合成 [设计]）：驳回 feedback 注入重规划轮（r5 §4
   * 「v2 内容忠实执行反馈」的宿主等价物）、chief 回合任务文本/wake 事实。
   * 缺省 = daemon 按 kind 兜底（CONTINUE_PROMPTS）或 title+spec 任务文本。 */
  instruction: z.string().nullable().optional(),
  /** worker 步任务面；chief 步缺省（无 todo 语境，r5 §3.1）。 */
  todo: z
    .object({
      id: recordId,
      seqNum: z.number().int(),
      title: z.string(),
      spec: z.string(),
    })
    .optional(),
  /** worker 步项目面；chief 步 = 探索基座（可缺省 = 裸目录回合）。 */
  project: z
    .object({
      id: recordId,
      name: z.string(),
      /** repo 绑定位（M3b worktree 契约接线，02 §3/§5.5）：cloneUrl = 托管
       * `<origin>/git/<teamId>/<repoName>`（02 §5.8 gitHostDomain 槽本地代位）
       * 或 GitHub https 派生；null = 项目未绑 repo（工作区退化为裸目录）。 */
      repo: z
        .object({
          kind: z.enum(['hosted', 'github']),
          cloneUrl: z.string(),
        })
        .nullable(),
    })
    .optional(),
  /** 执行 Agent（worker 步 = assignment 按步类取槽，02 §4.2/r5 §5；chief 步 =
   * 绑定 Agent，模型 = 绑定 Agent 模型 r5 §3.1）；null = 未指派（不可执行，
   * server 侧不派发 [设计]）。 */
  agent: z
    .object({
      id: recordId,
      displayName: z.string(),
      description: z.string().nullable(),
      provider: z.string().nullable(),
      modelId: z.string().nullable(),
      thinkingLevel: z.string().nullable(),
      /** 该 Agent 记忆条目注入 systemPrompt（02 §4.4 读路径最小形；注入形
       * [推断] 保留，04 附录 A）。 */
      memories: z.array(z.object({ title: z.string(), content: z.string() })).optional(),
    })
    .nullable(),
  /** chief 步块（r5 §3.1：Chief 回合 = pi 会话 + 服务端 relay 工具；细节
   * [设计]——wire 未采）。 */
  chief: z
    .object({
      /** ≡ conversationId 去 `chief-` 前缀后的线程 id（chief-<uuid> 同值）。 */
      threadId: recordId,
      /** server 合成 system prompt（charter + 团队资源清单 + 策略指引，
       * 02 §4.3 接口契约「输入：用户自然语言消息 + 团队资源清单」）。 */
      systemPrompt: z.string(),
      /** 本回合触发（user 消息轮 / wake 轮，r5 §3.5）。 */
      trigger: z.enum(['user', 'gate', 'settle', 'failed', 'wake']),
    })
    .optional(),
  /** remoteTools[]（服务端定义、服务端执行；chief 步 = 49 词表全量，
   * protocol/chief-tools.ts；worker 步 = 记忆三件套 WORKER_MEMORY_REMOTE_TOOLS，
   * 02 §4.4/r5 §6「worker 侧同族工具经 remoteTools 下发」。位形一手 = bundle
   * 提取，r5 §3.1）。 */
  remoteTools: z.array(remoteToolDefSchema).optional(),
  /** 已授权 MCP 端点（02 §7.1：per-Agent mcpServers[] 勾选 → 每回合连接、
   * 失败降级不阻断；工具名 `mcp__<slug>__<tool>`）。headers 含凭证 = per-step
   * 内存态下发不落盘（02 §8 运行时纪律同族）；版本墙（MCP_MIN_CLI_VERSION）
   * 未达 = 缺省不携带。 */
  mcpServers: z.array(mcpEndpointSchema).optional(),
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

/** POST /api/machine/tool/{stepId} 第三形 [设计]（M5 live streaming 复刻
 * 增量）：pi `text_delta` 事件的节流批量转发（daemon 250ms 窗口聚合）。
 * 服务端仅瞬态转发到 conversation stream（02 §1.2 会话流），不落库——
 * 终稿文本经 upload-urls transcript.json 兜底（02 §1.3 数据所有权不变）。 */
export const machineTranscriptDeltaBodySchema = z.object({
  kind: z.literal('transcript_delta'),
  text: z.string(),
});
export type MachineTranscriptDeltaBody = z.infer<typeof machineTranscriptDeltaBodySchema>;

/** POST /api/machine/tool/{stepId}——同径双形（r5 §3.1 bundle 提取）+ 复刻
 * 增量第三形（transcript delta [设计]，machineTranscriptDeltaBodySchema）：
 * ① live transcript 工具行回传（worker 步内建工具）= toolCallRecord，与
 *    upload-urls 终稿按 toolCall id 幂等去重 [设计]；body [推断]（r3 §1.6
 *    端点名 + transcript 工具行证据）。
 * ② remoteTools relay 执行（chief 步服务端工具）= {name, params} → {text}，
 *    位形一手 = bundle `request(serverUrl, /api/machine/tool/<stepId>, …,
 *    {name, params})` + `reply.body.text`（r5 §3.1 raw）。
 * ③ transcript delta = {kind:"transcript_delta", text} → {ok:true}。
 * 服务端按 body 形状分流（kind 判别位 = delta；有 params 无 id = relay）。 */
export const machineToolBodySchema = z.union([
  toolCallRecordSchema,
  machineToolRelayBodySchema,
  machineTranscriptDeltaBodySchema,
]);

/** relay 执行响应（bundle 消费面 `reply.body?.text`）；失败 = {error}(+transient)。 */
export const machineToolResponseSchema = z.union([
  machineOkResponseSchema,
  machineToolRelayResponseSchema,
]);

/** GET /api/machine/token/{stepId}——per-step 凭证下发（02 §5.4/§8：模型
 * key + 托管 repo git 凭证，daemon 内存持有不落盘常驻）。响应形状 [设计]
 * （端点名 + git fetch 无凭证失败旁证，r3 §1.6）。 */
export const machineTokenResponseSchema = z.object({
  /** 该步 Agent 的 provider 配置（apiKey 内存态经 SecretBox 解密下发，02 §8
   * 运行时层；无 key 网关可留空 = r3 §2 表单语义）。 */
  provider: providerConfigSchema.nullable(),
  /** 团队 Secret → 任务 shell 环境变量（仅 Agent 授权集，02 §8/r2 权限开关；
   * 服务端解析契约 = M2c services/credentials.ts）。 */
  env: z.record(z.string(), z.string()),
  /** 托管 repo git 凭证（02 §3/§5.4：per-step 注入；接线随 git 面）。 */
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
  /** 步收尾时 conv 分支 HEAD sha [设计]（M3b）：per-step checkpoint 数据源
   * （「恢复到此处」r3 §3.5/02 §4.2）+ 合并步 fast-forward 落地键
   * （「目标提交 <12hex>」r3 §3.9 面板同族）。 */
  commit: z.string().optional(),
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
    response: machineToolResponseSchema,
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
