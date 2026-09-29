// TanStack Query 数据层（M5，01 §4.1/S8 锁定：server state 全走查询失效
// 重取；SSE 事件仅作 invalidateQueries 提示信号——见 sse.ts）。
// 查询键词表 = 本文件 QK 单源；wire 类型单源 = @pacman/shared（02/A9）。

import type {
  AgentRecord,
  ApiKeyRow,
  Assignment,
  BuildRecord,
  ChiefGetResponse,
  ChiefThread,
  ConversationMessagesResponse,
  CreateAgentBody,
  CreateProjectBody,
  CreateProviderBody,
  CreateScheduleBody,
  DiffFileContent,
  DocumentDiff,
  DocumentDiffFile,
  FsPickResult,
  GithubConnectionStatus,
  GithubReposResponse,
  MachineRecord,
  McpServerRecord,
  ModelSourcesEnvelope,
  OAuthAuthorizeResponse,
  PatchAgentBody,
  PatchChiefBody,
  PlanRow,
  ProjectFileResponse,
  ProjectRecord,
  ProviderPreset,
  ProviderRecord,
  ScheduleRecord,
  SearchResponse,
  SecretRecord,
  SetSecretBody,
  SkillRecord,
  StepJournalRow,
  TagRecord,
  TeamMember,
  TeamRecord,
  TodoRecord,
  TokenUsage,
  UserRecord,
} from '@pacman/shared';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { api } from './client.js';

// 行形单源 = shared（01 §4.4 双端消费）：plan 行 = planRowSchema（record +
// content 透出 [推断] 封套）；steps 行 = stepJournalRowSchema（journal 位
// 透出 [设计]）；api-key 行 = apiKeyRowSchema（掩码投影，02 §8）。
export type { ApiKeyRow, PlanRow };
export type StepRow = StepJournalRow;

export interface ProvidersEnvelope {
  presets: ProviderPreset[];
  providers: ProviderRecord[];
}

// —— 查询 ————————————————————————————————————————————————————————————————

export const useSession = (enabled: boolean) =>
  useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<UserRecord>('/api/user/me'),
    enabled,
  });

export const useTeams = (enabled: boolean) =>
  useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<TeamRecord[]>('/api/teams'),
    enabled,
    staleTime: Number.POSITIVE_INFINITY, // team 恒 seed 一行（02 §2.2）
  });

export const useProjects = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['projects', teamId],
    queryFn: () => api.get<ProjectRecord[]>(`/api/projects?teamId=${teamId}`),
    enabled: enabled && teamId !== undefined,
  });

/** W4 #286：⌘K 面板 live 面服务端搜索——GET /api/search?q= 防抖 250ms
 * （击键间隔内不发出）；空串/未开面板不查。结果集直接喂 SearchPanel 的
 * server 位（fixture 面不经此钩）。 */
export function useSearchResults(query: string, enabled: boolean) {
  const debounced = useDebouncedValue(query, 250);
  const trimmed = debounced.trim();
  return useQuery({
    queryKey: ['search', trimmed],
    queryFn: () => api.get<SearchResponse>(`/api/search?q=${encodeURIComponent(trimmed)}`),
    enabled: enabled && trimmed !== '',
  });
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** #309 标签集读面（r9 §3.4）：新建任务 dialog 面板与详情 fresh meta 区
 *  chip 的数据源；键随选中项目（标签属项目）。 */
export const useTags = (projectId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['tags', projectId],
    queryFn: () => api.get<TagRecord[]>(`/api/projects/${projectId}/tags`),
    enabled: enabled && projectId !== undefined,
  });

/** #403 看板标签筛选 + #445 卡片标签：看板是 team 面而标签属项目——全
 * 项目标签集并查（useRunHistoryTokens 同式；queryKey 与 useTags 同键，缓存
 * 共享去重），合成 tagId → 标签行（TagChipData 同形投影——卡面 chip 吃
 * name+color）与 tagId → 词表名（筛选谓词面）双解析图。ready = 全部查询
 * 落定：首载未完时调用面不得激活筛选，否则 tagged 卡会闪隐（map 空 =
 * 全部不命中）。 */
export function useProjectTags(projectIds: string[], enabled: boolean) {
  const queries = useQueries({
    queries: projectIds.map((id) => ({
      queryKey: ['tags', id],
      queryFn: () => api.get<TagRecord[]>(`/api/projects/${id}/tags`),
      enabled,
    })),
  });
  return useMemo(() => {
    const tagById = new Map<string, Pick<TagRecord, 'id' | 'name' | 'color'>>();
    const nameById = new Map<string, string>();
    for (const q of queries) {
      for (const tag of q.data ?? []) {
        tagById.set(tag.id, { id: tag.id, name: tag.name, color: tag.color });
        nameById.set(tag.id, tag.name);
      }
    }
    return { tagById, nameById, ready: queries.every((q) => !q.isPending) };
  }, [queries]);
}

export const useTodos = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['todos', teamId],
    queryFn: () => api.get<TodoRecord[]>(`/api/todos?teamId=${teamId}`),
    enabled: enabled && teamId !== undefined,
  });

export const useTodo = (id: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['todo', id],
    queryFn: () => api.get<TodoRecord>(`/api/todos/${id}`),
    enabled: enabled && id !== undefined,
  });

export const useBuild = (id: string | null | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['build', id],
    queryFn: () => api.get<BuildRecord>(`/api/builds/${id}`),
    enabled: enabled && id != null,
  });

export const useProjectBuilds = (projectId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['projectBuilds', projectId],
    queryFn: () => api.get<BuildRecord[]>(`/api/projects/${projectId}/builds`),
    enabled: enabled && projectId !== undefined,
  });

export const useSteps = (buildId: string | null | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['steps', buildId],
    queryFn: () => api.get<StepRow[]>(`/api/builds/${buildId}/steps`),
    enabled: enabled && buildId != null,
  });

export const useMessages = (conversationId: string | null | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () =>
      api.get<ConversationMessagesResponse>(`/api/conversations/${conversationId}/messages`),
    enabled: enabled && conversationId != null,
  });

export const usePlans = (buildId: string | null | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['plans', buildId],
    queryFn: () => api.get<PlanRow[]>(`/api/builds/${buildId}/plans`),
    enabled: enabled && buildId != null,
  });

export const useBuildChanges = (buildId: string | null | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['changes', buildId],
    queryFn: () => api.get<{ files: DocumentDiffFile[] }>(`/api/builds/${buildId}/changes`),
    enabled: enabled && buildId != null,
  });

/** 单文件全文读面（#225 接 #224 端点，docpane changes 面「显示完整文件」）：
 *  conv 分支头单文件按需取。path 含 `/` 与中文，必须 encode（useProjectFile
 *  同律）。 */
export const useBuildChangeFile = (
  buildId: string | null | undefined,
  path: string | null,
  enabled: boolean,
) =>
  useQuery({
    queryKey: ['changeFile', buildId, path],
    queryFn: () =>
      api.get<DiffFileContent>(
        `/api/builds/${buildId}/changes/file?path=${encodeURIComponent(path ?? '')}`,
      ),
    enabled: enabled && buildId != null && path != null,
  });

export const useBuildUsage = (buildId: string | null | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['usage', buildId],
    queryFn: () => api.get<TokenUsage[]>(`/api/builds/${buildId}/usage`),
    enabled: enabled && buildId != null,
  });

/** W4 #288：运行历史 tokens 供数——buildHistory 各 build 的 usage 并查
 * （per-build 端点同键去重）→ Map<buildId, 四维合计>；未到的行缺省
 * （mapRunHistory tokensByBuild 槽省略不炸）。合计口径 = mapTokenUsage
 * 同式（input+output+cacheRead+cacheWrite）。 */
export function useRunHistoryTokens(buildIds: string[], enabled: boolean) {
  const queries = useQueries({
    queries: buildIds.map((id) => ({
      queryKey: ['usage', id],
      queryFn: () => api.get<TokenUsage[]>(`/api/builds/${id}/usage`),
      enabled,
      staleTime: 60_000,
    })),
  });
  return useMemo(() => {
    const byBuild = new Map<string, number>();
    buildIds.forEach((id, index) => {
      const rows = queries[index]?.data;
      if (!rows || rows.length === 0) return;
      byBuild.set(
        id,
        rows.reduce((sum, row) => sum + row.input + row.output + row.cacheRead + row.cacheWrite, 0),
      );
    });
    return byBuild;
  }, [buildIds, queries]);
}

export const useDocumentDiff = (
  documentId: string | null,
  againstVersion: number | null,
  enabled = true,
) =>
  useQuery({
    queryKey: ['documentDiff', documentId, againstVersion],
    queryFn: () =>
      api.get<DocumentDiff & { documentId: string }>(
        `/api/documents/${documentId}/diff${againstVersion != null ? `?againstVersion=${againstVersion}` : ''}`,
      ),
    enabled: enabled && documentId != null,
  });

export const useSchedules = (enabled: boolean) =>
  useQuery({
    queryKey: ['schedules'],
    queryFn: () => api.get<ScheduleRecord[]>('/api/schedules'),
    enabled,
  });

export const useMachines = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['machines', teamId],
    queryFn: () => api.get<MachineRecord[]>(`/api/teams/${teamId}/machines`),
    enabled: enabled && teamId !== undefined,
  });

export const useMembers = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['members', teamId],
    queryFn: () => api.get<TeamMember[]>(`/api/teams/${teamId}/members`),
    enabled: enabled && teamId !== undefined,
  });

export const useProviders = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['providers', teamId],
    queryFn: () => api.get<ProvidersEnvelope>(`/api/teams/${teamId}/providers`),
    enabled: enabled && teamId !== undefined,
  });

// providers 页 runtime tabs 数据源（spec 11 §A3/A4，#356）：pi + claude-code
// 两段。staleTime 0 = 每次 mount 重取——claude-code 段承载「实时反映
// ~/.claude/settings.json」语义（server 侧每次 GET 重读文件）。
export const useModelSources = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['model-sources', teamId],
    queryFn: () => api.get<ModelSourcesEnvelope>(`/api/teams/${teamId}/model-sources`),
    enabled: enabled && teamId !== undefined,
    staleTime: 0,
  });

/** GitHub 连接认证状态读面（#361 G2-T4）：login/scope，无 token 位（02 §8）。
 *  enabled 由调用面收窄到 github 选态——页面挂载不空转。 */
export const useGithubConnection = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['github-connection', teamId],
    queryFn: () => api.get<GithubConnectionStatus>(`/api/teams/${teamId}/github/connection`),
    enabled: enabled && teamId !== undefined,
  });

/** repo picker 数据面（#359 端点，#361 消费）：单页 100 条一次取回，搜索
 *  过滤在调用面本地做（上游 /user/repos 无查询参数面，server q 为同值兜底）。 */
export const useGithubRepos = (enabled: boolean) =>
  useQuery({
    queryKey: ['github-repos'],
    queryFn: () => api.get<GithubReposResponse>('/api/github/repos'),
    enabled,
  });

export const useSecrets = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['secrets', teamId],
    queryFn: () => api.get<SecretRecord[]>(`/api/teams/${teamId}/secrets`),
    enabled: enabled && teamId !== undefined,
  });

export const useApiKeys = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['apiKeys', teamId],
    queryFn: () => api.get<ApiKeyRow[]>(`/api/teams/${teamId}/api-keys`),
    enabled: enabled && teamId !== undefined,
  });

export const useMcpServers = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['mcpServers', teamId],
    queryFn: () => api.get<McpServerRecord[]>(`/api/teams/${teamId}/mcp-servers`),
    enabled: enabled && teamId !== undefined,
  });

export const useSkills = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['skills', teamId],
    queryFn: () => api.get<SkillRecord[]>(`/api/skills?teamId=${teamId}`),
    enabled: enabled && teamId !== undefined,
  });

export const useChief = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['chief', teamId],
    queryFn: () => api.get<ChiefGetResponse>(`/api/teams/${teamId}/chief`),
    enabled: enabled && teamId !== undefined,
  });

export const useChiefThreads = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['chiefThreads', teamId],
    queryFn: () => api.get<ChiefThread[]>(`/api/teams/${teamId}/chief/threads`),
    enabled: enabled && teamId !== undefined,
  });

export const useNotifications = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['notifications', teamId],
    queryFn: () => api.get<{ unreadThreadIds: string[] }>(`/api/teams/${teamId}/notifications`),
    enabled: enabled && teamId !== undefined,
  });

export const useProjectTree = (projectId: string | undefined, ref: string | undefined) =>
  useQuery({
    queryKey: ['tree', projectId, ref],
    queryFn: () =>
      api.get<{
        ref: string;
        commit: string;
        path: string;
        entries: { name: string; type: string }[];
      }>(
        `/api/projects/${projectId}/tree${ref !== undefined ? `?ref=${encodeURIComponent(ref)}` : ''}`,
      ),
    enabled: projectId !== undefined,
  });

/** 单文件读面(#202 文件查看器;02 §3 读裸库单文件,server 已在,
 *  wire.test INFERRED_ROUTES 登记)。path 含 `/` 与中文,必须 encode。 */
export const useProjectFile = (
  projectId: string | undefined,
  path: string | undefined,
  ref: string | undefined,
) =>
  useQuery({
    queryKey: ['file', projectId, path, ref],
    queryFn: () =>
      api.get<ProjectFileResponse>(
        `/api/projects/${projectId}/file?path=${encodeURIComponent(path ?? '')}${ref !== undefined ? `&ref=${encodeURIComponent(ref)}` : ''}`,
      ),
    enabled: projectId !== undefined && path !== undefined,
  });

/** 提交历史读面（#149 文件|历史 分段「历史」；[推断] 端点，wire.test
 *  INFERRED_ROUTES 登记）。 */
export const useProjectCommits = (projectId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['commits', projectId],
    queryFn: () =>
      api.get<{
        ref: string;
        commits: {
          sha: string;
          shortSha: string;
          message: string;
          authorName: string;
          at: number;
        }[];
      }>(`/api/projects/${projectId}/commits`),
    enabled: enabled && projectId !== undefined,
  });

// —— 变更（mutation 后失效重取 = S8 canon）———————————————————————————————

export function useApiMutations(teamId: string | undefined) {
  const qc = useQueryClient();
  const invalidateAll = () => {
    void qc.invalidateQueries();
  };
  return {
    createTodo: useMutation({
      // spec 15 #394：web 面不产标题——wire 上 title 恒空串 = server 派生占位
      // 标题（首行截断），执行 agent 接单后回填正式标题；标签 = 固定词表
      // agent 归类。chief/mcp 的显式标题路径不经此 hook（REST 契约不变）。
      mutationFn: (input: { projectId: string; spec: string }) =>
        api.post<TodoRecord>(`/api/projects/${input.projectId}/todos`, {
          title: '',
          spec: input.spec,
        }),
      onSuccess: invalidateAll,
    }),
    patchTodo: useMutation({
      mutationFn: (input: {
        id: string;
        body: {
          title?: string;
          spec?: string;
          phase?: string;
          orderIndex?: number;
          tagIds?: string[];
          /** 指派槽级 patch(#209「编辑分配」接线;server #208 槽级 merge:
           *  提供的槽覆盖,未提供的槽保持现状)。 */
          assignment?: {
            plan?: NonNullable<Assignment['plan']>;
            build?: NonNullable<Assignment['build']>;
          };
        };
      }) => api.patch<TodoRecord>(`/api/todos/${input.id}`, input.body),
      onSuccess: invalidateAll,
    }),
    deleteTodo: useMutation({
      mutationFn: (id: string) => api.del<void>(`/api/todos/${id}`),
      onSuccess: invalidateAll,
    }),
    startBuilds: useMutation({
      mutationFn: (input: {
        projectId: string;
        todoIds: string[];
        assignment: Assignment;
        withPlan: boolean;
      }) =>
        api.post<{ builds: BuildRecord[] }>(`/api/projects/${input.projectId}/builds`, {
          todoIds: input.todoIds,
          assignment: input.assignment,
          withPlan: input.withPlan,
        }),
      onSuccess: invalidateAll,
    }),
    stepAction: useMutation({
      mutationFn: (input: {
        buildId: string;
        body:
          | { action: 'confirm' }
          | { action: 'revision'; side: 'plan'; feedback: string; clientMessageId: string }
          // M7 #312 AI 审核（r8 §3.1）：入队审核步,可选 focus 入参透传 server。
          | { action: 'review'; agentId: string; focus: string }
          // #320 失败面发送 = 带反馈重启（r9 §3.3；shared buildStepActionBodySchema 同形）。
          | { action: 'restart'; feedback: string; clientMessageId: string };
      }) => api.post<{ delegated: true }>(`/api/builds/${input.buildId}/steps`, input.body),
      onSuccess: invalidateAll,
    }),
    mergeBuild: useMutation({
      mutationFn: (buildId: string) =>
        api.post<{ delegated: true }>(`/api/builds/${buildId}/merge`, {}),
      onSuccess: invalidateAll,
    }),
    // 停止钮（M7 #308，r9 §3.3）：discard = 「丢弃本轮修改」勾选位。
    // delegated:true = claimed 步机器信号在途（「正在停止…」过渡态由页面
    // 本地保持到 steps 重取见终态）；false = pending 步 server 即时取消。
    // 409（步已收尾竞态）同样 invalidate——数据面已前进，重取即收敛。
    stopBuild: useMutation({
      mutationFn: (input: { buildId: string; discard: boolean }) =>
        api.post<{ delegated: boolean }>(`/api/builds/${input.buildId}/stop`, {
          discard: input.discard,
        }),
      onSuccess: invalidateAll,
      onError: invalidateAll,
    }),
    createSchedule: useMutation({
      mutationFn: (body: CreateScheduleBody) => api.post<ScheduleRecord>('/api/schedules', body),
      onSuccess: invalidateAll,
    }),
    deleteSchedule: useMutation({
      mutationFn: (id: string) => api.del<void>(`/api/schedules/${id}`),
      onSuccess: invalidateAll,
    }),
    // 机器页 per-runtime 开关写回（spec 11 A8/A9，#357）：enabledRuntimes
    // 全量替换；乐观更新 = 点按即翻 aria-checked，成/败都 invalidate 收敛真值。
    patchMachineRuntimes: useMutation({
      mutationFn: (input: { id: string; enabledRuntimes: string[] }) =>
        api.patch<MachineRecord>(`/api/machines/${input.id}`, {
          enabledRuntimes: input.enabledRuntimes,
        }),
      onMutate: (input) => {
        qc.setQueryData<MachineRecord[]>(['machines', teamId], (rows) =>
          (rows ?? []).map((m) =>
            m.id === input.id ? { ...m, enabledRuntimes: input.enabledRuntimes } : m,
          ),
        );
      },
      onSuccess: invalidateAll,
      onError: invalidateAll,
    }),
    // body 单源 = shared createProjectBodySchema（spec 12 / #360：kind +
    // localPath / githubRepo 契约面；既有 repoKind 调用点同义兼容）。
    createProject: useMutation({
      mutationFn: (body: CreateProjectBody) =>
        api.post<ProjectRecord>('/api/projects', { ...body, ...(teamId ? { teamId } : {}) }),
      onSuccess: invalidateAll,
    }),
    // #440 原生文件夹选取（ADR 0003）：取消 = {path:null} 正常结局非错误面；
    // 纯读取动作，无缓存失效。
    pickLocalFolder: useMutation({
      mutationFn: () => api.post<FsPickResult>('/api/fs/pick'),
    }),
    // #189 删除面(#207 接线):级联语义单源在 server services/projects.ts。
    deleteProject: useMutation({
      mutationFn: (id: string) => api.del<void>(`/api/projects/${id}`),
      onSuccess: invalidateAll,
    }),
    chiefSend: useMutation({
      mutationFn: (input: { threadId: string | null; content: string }) =>
        input.threadId === null
          ? api.post<{ thread: ChiefThread }>(`/api/teams/${teamId}/chief/threads`, {
              content: input.content,
            })
          : api.post<{ thread: ChiefThread }>(`/api/conversations/${input.threadId}/messages`, {
              content: input.content,
            }),
      onSuccess: invalidateAll,
    }),
    patchChief: useMutation({
      mutationFn: (body: PatchChiefBody) =>
        api.patch<ChiefGetResponse>(`/api/teams/${teamId}/chief`, body),
      onSuccess: invalidateAll,
    }),
    createProvider: useMutation({
      mutationFn: (body: CreateProviderBody) =>
        api.post<ProviderRecord>(`/api/teams/${teamId}/providers`, body),
      onSuccess: invalidateAll,
    }),
    // #231 OAuth 握手：签发授权 URL 后整页跳走（同页签流）——成功不
    // invalidate（回跳 = 全量重载），失败留页 inline 呈现。
    startProviderOAuth: useMutation({
      mutationFn: (presetId: string) =>
        api.post<OAuthAuthorizeResponse>(
          `/api/teams/${teamId}/providers/oauth/${presetId}/authorize`,
          {},
        ),
    }),
    // #361 GitHub 连接认证：startProviderOAuth 同律（同页签整页跳走，成功
    // 不 invalidate——回跳 = 全量重载；失败留页 inline 呈现）。
    startGithubOAuth: useMutation({
      mutationFn: () =>
        api.post<OAuthAuthorizeResponse>(`/api/teams/${teamId}/github/oauth/authorize`, {}),
    }),
    // 断开 = 删行幂等（server DAO 单点）；invalidate 收敛 connection/repos 读面。
    disconnectGithub: useMutation({
      mutationFn: () => api.del<void>(`/api/teams/${teamId}/github/connection`),
      onSuccess: invalidateAll,
    }),
    deleteProvider: useMutation({
      mutationFn: (id: string) => api.del<void>(`/api/teams/${teamId}/providers/${id}`),
      onSuccess: invalidateAll,
    }),
    createSecret: useMutation({
      mutationFn: (body: SetSecretBody) =>
        api.post<SecretRecord>(`/api/teams/${teamId}/secrets`, body),
      onSuccess: invalidateAll,
    }),
    deleteSecret: useMutation({
      mutationFn: (id: string) => api.del<void>(`/api/teams/${teamId}/secrets/${id}`),
      onSuccess: invalidateAll,
    }),
    createApiKey: useMutation({
      // W4 #287：全表单 body（r3 §6 权限位弹窗；形状 = server routes 的
      // createApiKeyBodySchema 同构——apiKeyRecordSchema + name 可选）。
      mutationFn: (body: {
        name: string | null;
        gitAccess: boolean;
        mcpAccess: boolean;
        toolGrants: { read: string[]; write: string[] };
      }) => api.post<ApiKeyRow & { plaintext?: string }>(`/api/teams/${teamId}/api-keys`, body),
      onSuccess: invalidateAll,
    }),
    // skills 无 mutation 面（spec 13 #367：技能 = server 本地目录现扫只读
    // 投影；写技能 = 往目录放文件，无上传/扫描端点）。mcp-servers 同律
    // （spec 13 #368：MCP = 本机 ~/.claude.json 只读投影，无建/改/删端点）。
    createAgent: useMutation({
      mutationFn: (body: CreateAgentBody) =>
        api.post<{ id: string }>(`/api/teams/${teamId}/agents`, body),
      onSuccess: invalidateAll,
    }),
    patchAgent: useMutation({
      mutationFn: (input: { id: string; body: PatchAgentBody }) =>
        api.patch<AgentRecord>(`/api/teams/${teamId}/agents/${input.id}`, input.body),
      onSuccess: invalidateAll,
    }),
    // W3 steer（#280，06 册 D9）：build 会话运行中补话——POST messages 的
    // build 分支（#278 server 面）。成功 = 会话流 message 事件驱动重取（SSE
    // 兜底之外这里再失效一次）；失败（409 无在跑步）由调用面呈现，输入保留。
    sendSteer: useMutation({
      mutationFn: (input: { conversationId: string; content: string }) =>
        api.post<{ message: { id: string } }>(
          `/api/conversations/${input.conversationId}/messages`,
          { content: input.content },
        ),
      onSuccess: (_data, input) => {
        void qc.invalidateQueries({ queryKey: ['messages', input.conversationId] });
      },
    }),
  };
}

export type ApiMutations = ReturnType<typeof useApiMutations>;
