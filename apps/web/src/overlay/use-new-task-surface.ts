// New-task creation surface (issue #389): the N hotkey and the sidebar
// 新任务 row open the same NewTaskDialog on every route. Extracted from
// board-page's wiring (#66 create / #176 project select / #309 tags /
// #310 spec+attachments / #311 mentions) so two faces share one save path:
// the board keeps its dialog (fixture saves land a local card via
// onFixtureSave), and AppSidebar's global dialog serves every route that
// has no dialog of its own (the searchPanel/#129 override precedent).
// Query discipline: todos/projects were already eager on every shell
// (deduped TQ keys — zero new traffic); members/skills/machines stay eager
// only for the board (its card-level 开始 eats firstAgentId before any
// dialog opens) and gate on the dialog's open state everywhere else.

import { TAG_DEFAULT_COLOR, type TodoRecord as WireTodo } from '@pacman/shared';
import { useCallback, useMemo, useState } from 'react';
import { attachFile } from '../api/attachments.js';
import {
  useApiMutations,
  useMachines,
  useMembers,
  useProjects,
  useSkills,
  useTags,
  useTodos,
} from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import type { FixtureSet, TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import type { MentionGroups } from './mention-picker.js';
import type { NewTaskDialogProps } from './new-task-dialog.js';

interface NewTaskSurfaceOpts {
  /** fixture 面 mention 数据源：board 传合并集（fixture.todos + 本地新建卡）；
   *  缺省 = fixture.todos。 */
  fixtureTodos?: TodoRecord[];
  /** true = members/skills/machines 保持 eager（board 现状：卡片级 开始 在
   *  dialog 开之前就吃 firstAgentId）；缺省 = 随 open 态 gated，不开不发。 */
  eager?: boolean;
  /** fixture 面保存落点（board = 本地卡 append，#66 律；忽略 spec/tagIds,
   *  与原 fixture 分支同）。缺省 = 仅关 dialog。 */
  onFixtureSave?: (title: string) => void;
}

export interface NewTaskSurface {
  /** 打开 dialog（N 热键 / 侧栏行 / 页面按钮共用的唯一 opener，幂等）。 */
  openDialog: () => void;
  /** live 面默认执行 Agent（board 卡片级 开始 复用；02 §6.2 双槽同值）。 */
  firstAgentId: string | null;
  /** 直接摊给 <NewTaskDialog>。 */
  dialogProps: NewTaskDialogProps;
}

export function useNewTaskSurface(fixture: FixtureSet, opts: NewTaskSurfaceOpts = {}) {
  const { fixtureTodos: fixtureTodosOpt, eager = false, onFixtureSave } = opts;
  const { live, teamId } = useLiveData();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const openDialog = useCallback(() => setOpen(true), []);
  const closeDialog = useCallback(() => setOpen(false), []);
  const todosQ = useTodos(teamId, live);
  const projectsQ = useProjects(teamId, live);
  // #389 gated 面：非 board 路由（AppSidebar 全局 dialog）不开窗不发请求；
  // board 传 eager 保持原 eager 行为字节不变。
  const dataOn = live && (eager || open);
  const membersQ = useMembers(teamId, dataOn);
  const machinesQ = useMachines(teamId, dataOn);
  const skillsQ = useSkills(teamId, dataOn);
  const mutations = useApiMutations(teamId);

  // #309 标签面（r9 §3.4）：dialog 上报的选中项目 → tags 查询键；面板数据
  // 只在 dialog 开时取。新建标签 = POST tags（color 客户端缺省
  // TAG_DEFAULT_COLOR，r9 §3.4），解析出的 id 由 dialog 自动选中。
  const [dialogProjectId, setDialogProjectId] = useState<string | undefined>(undefined);
  const tagsQ = useTags(dialogProjectId ?? projectsQ.data?.[0]?.id, live && open);
  const createTag = useCallback(
    async (name: string) => {
      let projectId = dialogProjectId ?? projectsQ.data?.[0]?.id;
      if (!projectId) {
        // 无项目：先建默认托管项目再落标签——保存路径同语义（[设计]，
        // 原站无项目建标签行为未捕获；标签属项目，无项目即无处可挂）。
        const created = await mutations.createProject.mutateAsync({
          name: t('默认项目'),
          repoKind: 'hosted',
        });
        projectId = created.id;
      }
      const created = await mutations.createTag.mutateAsync({
        projectId,
        name,
        color: TAG_DEFAULT_COLOR,
      });
      return created.id;
    },
    [dialogProjectId, projectsQ.data, mutations.createTag, mutations.createProject, t],
  );
  // M7 #310 附件：live 创建面把 spec 提到此处,附件 token 才能注入。
  // 新建对话框关闭 = 直接清空（持久化场景下再次打开应从空开始）。
  const [liveSpec, setLiveSpec] = useState('');

  // live 面的默认执行 Agent（开始/重跑无 dialog 位——已建屏无开始弹窗，
  // assignment 取团队首个 Agent [设计]，02 §6.2 双槽同值；E2E 脊柱口径）。
  const firstAgentId = useMemo(() => {
    const member = (membersQ.data ?? []).find((m) => m.memberType === 'agent');
    return member?.actorId ?? null;
  }, [membersQ.data]);

  const createTodo = useCallback(
    (title: string, spec: string, selectedProjectId?: string, tagIds?: string[]) => {
      setOpen(false);
      // 提交后清空 spec,下次打开新建对话框从空开始
      setLiveSpec('');
      if (live) {
        // #176: dialog 选中项目优先;未选(空集/查询未决)退首行真值
        const projectId = selectedProjectId ?? projectsQ.data?.[0]?.id;
        if (projectId) {
          mutations.createTodo.mutate({ projectId, title, spec, tagIds });
          return;
        }
        // 无项目：先建默认托管项目再落任务（self-host 单用户语义 [设计]，
        // 02 §3 项目创建流两分支的 hosted 侧）。tagIds 常态为空（无项目即
        // 无标签可选）；例外 = 建标签已先落默认项目（createTag 路径）而
        // projectsQ 重取尚未回灌的窄竞态窗——此时这里会多建一个项目且
        // tagIds 属前项目，由 server 项目边界校验 400 兜底 [设计]，不静默。
        mutations.createProject.mutate(
          { name: t('默认项目'), repoKind: 'hosted' },
          {
            onSuccess: (p) => mutations.createTodo.mutate({ projectId: p.id, title, spec, tagIds }),
          },
        );
        return;
      }
      onFixtureSave?.(title);
    },
    [live, projectsQ.data, mutations.createTodo, mutations.createProject, onFixtureSave, t],
  );

  // 保存并开始（r2 §4.2 双钮语义，M5 live）：创建 → POST builds（withPlan，
  // 首 Agent 双槽指派 [设计]）。fixture 面 = 同 保存。M7 #310:带 spec 走真。
  const createAndStart = useCallback(
    (title: string, spec: string, selectedProjectId?: string, tagIds?: string[]) => {
      setOpen(false);
      setLiveSpec('');
      if (!live) {
        createTodo(title, spec, selectedProjectId, tagIds);
        return;
      }
      const start = (projectId: string) =>
        mutations.createTodo.mutate(
          { projectId, title, spec, tagIds },

          {
            onSuccess: (created) =>
              mutations.startBuilds.mutate({
                projectId,
                todoIds: [created.id],
                assignment: {
                  plan: firstAgentId ? { agentId: firstAgentId } : null,
                  build: firstAgentId ? { agentId: firstAgentId } : null,
                },
                withPlan: true,
              }),
          },
        );
      const projectId = selectedProjectId ?? projectsQ.data?.[0]?.id;
      if (projectId) start(projectId);
      else
        mutations.createProject.mutate(
          { name: t('默认项目'), repoKind: 'hosted' },
          { onSuccess: (p) => start(p.id) },
        );
    },
    [
      live,
      createTodo,
      mutations.createTodo,
      mutations.startBuilds,
      mutations.createProject,
      projectsQ.data,
      firstAgentId,
      t,
    ],
  );

  // M7 #310 附件 wire：live 创建面 spec 由本 hook 持 state,token 才能注入。
  // fixture 面不传 → dialog 内部 useState fallback,行为字节不变。
  const onAttachment = useCallback(async (files: File[]) => {
    // #310 三步 wire（r9 §3.1）：每个文件走 grant + upload，失败仅记日志
    // 不发（用户继续编辑 spec,已发成功的 token 仍落入）；token 拼到 spec。
    // 多文件按选序拼接，每个 token 占独立行（与 detail-page composer 一致）。
    const tokens: string[] = [];
    for (const file of files) {
      try {
        const r = await attachFile({ file, scope: 'spec' });
        tokens.push(r.token);
      } catch (err) {
        console.error('attachment failed', file.name, err);
      }
    }
    if (tokens.length > 0) {
      setLiveSpec((current) => {
        const joiner = current === '' || current.endsWith('\n') ? '' : '\n';
        return `${current}${joiner}${tokens.join('\n')}\n`;
      });
    }
  }, []);

  // #176 新建任务 dialog 项目选择器数据位:live = projectsQ 真值投影
  // (undefined = 查询未决);fixture = scenario projectNames(缺省 =
  // undefined → dialog 退 canon 单默认项目)。选择是纯表单 state。
  const projectRows = useMemo(() => {
    if (live) return projectsQ.data?.map((p) => ({ id: p.id, name: p.name }));
    if (fixture.projectNames == null) return undefined;
    return Object.entries(fixture.projectNames).map(([id, name]) => ({ id, name }));
  }, [live, projectsQ.data, fixture.projectNames]);

  // #311 mention picker groups: the new-task dialog needs the same entity
  // set the composer surfaces. Live pulls the canonical REST hooks; fixture
  // derives from the local scenario (resources carries skills + machines;
  // team roster carries agents; projectNames drives projects). When the
  // live hooks are still loading, fall back to the empty rows so the picker
  // still opens with a 0 count.
  const liveTodoSet: WireTodo[] = todosQ.data ?? [];
  const fixtureTodos = fixtureTodosOpt ?? fixture.todos;
  const mentionGroups: MentionGroups = live
    ? {
        todo: liveTodoSet.map((t) => ({
          id: t.id,
          label: `#${t.seqNum} ${t.title}`,
          seq: t.seqNum,
          subtitle: t.phase,
        })),
        agent: (membersQ.data ?? [])
          .filter((m) => m.memberType === 'agent')
          .map((m) => ({
            id: m.actorId,
            label: (m.actor as { displayName?: string } | undefined)?.displayName ?? m.actorId,
            subtitle:
              (m.actor as { description?: string | null } | undefined)?.description ?? undefined,
          })),
        project: (projectsQ.data ?? []).map((p) => ({ id: p.id, label: p.name })),
        skill: (skillsQ.data ?? []).map((s) => ({
          id: s.id,
          label: s.name,
          subtitle: s.description ?? undefined,
        })),
        machine: (machinesQ.data ?? []).map((m) => ({ id: m.id, label: m.name })),
      }
    : {
        todo: fixtureTodos.map((t) => ({
          id: t.id,
          label: `#${t.seqNum} ${t.title}`,
          seq: t.seqNum,
          subtitle: t.phase,
        })),
        agent: (fixture.team?.agents ?? []).map((a) => ({
          id: a.id,
          label: a.displayName,
          subtitle: a.role ?? a.model,
        })),
        project: Object.entries(fixture.projectNames ?? {}).map(([id, name]) => ({
          id,
          label: name,
        })),
        skill: (fixture.resources?.skills ?? []).map((s) => ({
          id: s.name,
          label: s.name,
          subtitle: s.description,
        })),
        machine: (fixture.resources?.machines ?? []).map((m) => ({
          id: m.name,
          label: m.name,
          subtitle: m.sub,
        })),
      };

  const dialogProps: NewTaskDialogProps = {
    open,
    onClose: closeDialog,
    onSave: createTodo,
    onSaveAndStart: live ? createAndStart : undefined,
    projects: projectRows,
    tags: tagsQ.data,
    onCreateTag: live ? createTag : undefined,
    onProjectChange: setDialogProjectId,
    ...(live ? { spec: liveSpec, onSpecChange: setLiveSpec, onAttachment } : {}),
    mentionGroups,
  };
  return { openDialog, firstAgentId, dialogProps };
}
