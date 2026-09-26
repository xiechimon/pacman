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
  CreateMcpServerBody,
  CreateProviderBody,
  CreateScheduleBody,
  DiffFileContent,
  DocumentDiff,
  DocumentDiffFile,
  FetchSkillFilesResponse,
  MachineRecord,
  McpServerRecord,
  OAuthAuthorizeResponse,
  PatchAgentBody,
  PatchChiefBody,
  PlanRow,
  ProjectFileResponse,
  ProjectRecord,
  ProviderPreset,
  ProviderRecord,
  ScanSkillsBody,
  ScanSkillsResponse,
  ScheduleRecord,
  SearchResponse,
  SecretRecord,
  SetSecretBody,
  SkillRecord,
  StepJournalRow,
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
 * server 位（fixture/parity 面不经此钩）。 */
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
      mutationFn: (input: { projectId: string; title: string; spec: string }) =>
        api.post<TodoRecord>(`/api/projects/${input.projectId}/todos`, {
          title: input.title,
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
    createSchedule: useMutation({
      mutationFn: (body: CreateScheduleBody) => api.post<ScheduleRecord>('/api/schedules', body),
      onSuccess: invalidateAll,
    }),
    deleteSchedule: useMutation({
      mutationFn: (id: string) => api.del<void>(`/api/schedules/${id}`),
      onSuccess: invalidateAll,
    }),
    createProject: useMutation({
      mutationFn: (body: { name: string; repoKind?: 'hosted' | 'github'; githubRepo?: string }) =>
        api.post<ProjectRecord>('/api/projects', { ...body, ...(teamId ? { teamId } : {}) }),
      onSuccess: invalidateAll,
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
    createMcpServer: useMutation({
      mutationFn: (body: CreateMcpServerBody) =>
        api.post<McpServerRecord>(`/api/teams/${teamId}/mcp-servers`, body),
      onSuccess: invalidateAll,
    }),
    deleteMcpServer: useMutation({
      mutationFn: (id: string) => api.del<void>(`/api/teams/${teamId}/mcp-servers/${id}`),
      onSuccess: invalidateAll,
    }),
    createSkill: useMutation({
      mutationFn: (body: {
        name: string;
        description?: string | null;
        files: Record<string, string>;
      }) => api.post<SkillRecord>('/api/skills', { ...body, ...(teamId ? { teamId } : {}) }),
      onSuccess: invalidateAll,
    }),
    // #235 GitHub 扫描双模式（#223 端点）：缺省 path = 候选发现，给 path =
    // 文件集取回（与 POST /api/skills body.files 同形，选中即喂 createSkill）。
    // 同端点同 body schema（shared ScanSkillsBody 单源）；纯发现/取回调用，
    // 无 server state 变更 → 不 invalidateAll。
    scanSkills: useMutation({
      mutationFn: (body: ScanSkillsBody) =>
        api.post<ScanSkillsResponse>('/api/skills/scan', {
          ...body,
          ...(teamId ? { teamId } : {}),
        }),
    }),
    fetchSkillFiles: useMutation({
      mutationFn: (body: ScanSkillsBody & { path: string }) =>
        api.post<FetchSkillFilesResponse>('/api/skills/scan', {
          ...body,
          ...(teamId ? { teamId } : {}),
        }),
    }),
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
