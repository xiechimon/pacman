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
  CreateScheduleBody,
  DiffFileContent,
  DocumentDiff,
  DocumentDiffFile,
  MachineRecord,
  McpServerRecord,
  PatchChiefBody,
  PlanRow,
  ProjectFileResponse,
  ProjectRecord,
  ProviderPreset,
  ProviderRecord,
  ScheduleRecord,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
          | { action: 'revision'; side: 'plan'; feedback: string; clientMessageId: string };
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
      mutationFn: (body: Record<string, unknown>) =>
        api.post<ProviderRecord>(`/api/teams/${teamId}/providers`, body),
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
      mutationFn: (body: Record<string, unknown>) =>
        api.post<ApiKeyRow & { plaintext?: string }>(`/api/teams/${teamId}/api-keys`, body),
      onSuccess: invalidateAll,
    }),
    createMcpServer: useMutation({
      mutationFn: (body: Record<string, unknown>) =>
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
    createAgent: useMutation({
      mutationFn: (body: Record<string, unknown>) =>
        api.post<{ id: string }>(`/api/teams/${teamId}/agents`, body),
      onSuccess: invalidateAll,
    }),
    patchAgent: useMutation({
      mutationFn: (input: { id: string; body: Record<string, unknown> }) =>
        api.patch<AgentRecord>(`/api/teams/${teamId}/agents/${input.id}`, input.body),
      onSuccess: invalidateAll,
    }),
  };
}

export type ApiMutations = ReturnType<typeof useApiMutations>;
