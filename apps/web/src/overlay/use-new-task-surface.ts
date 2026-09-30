// New-task creation surface (issue #389): the N hotkey and the sidebar
// 新任务 row open the same NewTaskDialog on every route. Extracted from
// board-page's wiring (#66 create / #176 project select / #310 spec+attachments
// / #311 mentions) so two faces share one save path: the board keeps its
// dialog (fixture saves land a local card via onFixtureSave), and AppSidebar's
// global dialog serves every route that has no dialog of its own (the
// searchPanel/#129 override precedent).
// #394 (spec 15) 重塑：提交 = 正文单字段 + 项目 id（无标题/标签——标题
// server 派生占位、agent 回填；标签固定词表），本 hook 同形。
// #404：project 页同吃本面——差异显式参数化：anchorProjectId = 路由项目
// 锚（选择器行置首 + 保存缺省解析），mentions 闸 = 提及数据面有无
// （project 页无此面；machines/skills 查询随闸）。
// Query discipline: todos/projects were already eager on every shell
// (deduped TQ keys — zero new traffic); members/skills/machines stay eager
// only for the board (its card-level 开始 eats firstAgentId before any
// dialog opens) and gate on the dialog's open state everywhere else——
// project 页 members 同 eager（保存并开始点击时吃 firstAgentId）。

import type { TodoRecord as WireTodo } from '@pacman/shared';
import { useCallback, useMemo, useState } from 'react';
import { attachFile } from '../api/attachments.js';
import {
  useApiMutations,
  useMachines,
  useMembers,
  useProjects,
  useSkills,
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
  /** fixture 面保存落点（board = 本地卡 append，#66 律；参数 = 正文，标题
   *  由 localTodo 按 shared 规则派生——#394 同律）。缺省 = 仅关 dialog。 */
  onFixtureSave?: (spec: string) => void;
  /** 页面锚定项目（#404 project 页 = 路由项目 id，#305 律）：dialog 项目
   *  选择器行把它置首（未动选择的默认行 = rows[0]，提交锚定本页项目而非
   *  首项目）；live 保存缺省解析 = 选中 ?? 锚 ?? 首项目——锚恒在位时下方
   *  「无项目建默认项目」分支不可达。缺省 = board/全局面语义（首项目，
   *  空集建默认项目，#176/#83 律）。 */
  anchorProjectId?: string;
  /** 提及 picker 数据面（#311）：缺省 true = live hooks / fixture 派生
   *  全集；false = 不传 mentionGroups（picker 空集）且 machines/skills
   *  查询随闸（project 页面）。 */
  mentions?: boolean;
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
  const {
    fixtureTodos: fixtureTodosOpt,
    eager = false,
    onFixtureSave,
    anchorProjectId,
    mentions = true,
  } = opts;
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
  // machines/skills 仅提及面消费（#311）——mentions=false 的面（project）
  // 不发请求。
  const machinesQ = useMachines(teamId, dataOn && mentions);
  const skillsQ = useSkills(teamId, dataOn && mentions);
  const mutations = useApiMutations(teamId);

  // M7 #310 附件：live 创建面把 spec 提到此处,附件 token 才能注入。
  // 新建对话框关闭 = 直接清空（持久化场景下再次打开应从空开始）。
  const [liveSpec, setLiveSpec] = useState('');

  // live 面的默认执行 Agent（开始/重跑无 dialog 位——已建屏无开始弹窗，
  // assignment 取团队首个 Agent [设计]，02 §6.2 双槽同值；E2E 脊柱口径）。
  const firstAgentId = useMemo(() => {
    const member = (membersQ.data ?? []).find((m) => m.memberType === 'agent');
    return member?.actorId ?? null;
  }, [membersQ.data]);

  // spec 15 #394：提交 = 正文单字段。标题不再采集——live 面 wire 上 title
  // 恒空串由 server 派生占位（首行截断），agent 接单后回填；fixture 面 =
  // onFixtureSave → localTodo 内同一 shared 规则派生。
  // 保存缺省解析（#176 + #404 参数位）：dialog 选中项目优先；未选（空集/
  // 查询未决）退锚定页路由项目（project），再退首行真值。锚恒在位 ⇒ 两
  // 保存路径的「无项目建默认项目」分支不可达（board/全局面无锚，原样可达）。
  const resolveProjectId = useCallback(
    (selectedProjectId?: string) => selectedProjectId ?? anchorProjectId ?? projectsQ.data?.[0]?.id,
    [anchorProjectId, projectsQ.data],
  );
  const createTodo = useCallback(
    (spec: string, selectedProjectId?: string) => {
      setOpen(false);
      // 提交后清空 spec,下次打开新建对话框从空开始
      setLiveSpec('');
      if (live) {
        const projectId = resolveProjectId(selectedProjectId);
        if (projectId) {
          mutations.createTodo.mutate({ projectId, spec });
          return;
        }
        // 无项目：先建默认托管项目再落任务（self-host 单用户语义 [设计]，
        // 02 §3 项目创建流两分支的 hosted 侧）。
        mutations.createProject.mutate(
          { name: t('默认项目'), repoKind: 'hosted' },
          {
            onSuccess: (p) => mutations.createTodo.mutate({ projectId: p.id, spec }),
          },
        );
        return;
      }
      onFixtureSave?.(spec);
    },
    [live, resolveProjectId, mutations.createTodo, mutations.createProject, onFixtureSave, t],
  );

  // 保存并开始（r2 §4.2 双钮语义，M5 live）：创建 → POST builds（withPlan，
  // 首 Agent 双槽指派 [设计]）。fixture 面 = 同 保存。M7 #310:带 spec 走真。
  const createAndStart = useCallback(
    (spec: string, selectedProjectId?: string) => {
      setOpen(false);
      setLiveSpec('');
      if (!live) {
        createTodo(spec, selectedProjectId);
        return;
      }
      const start = (projectId: string) =>
        mutations.createTodo.mutate(
          { projectId, spec },

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
      const projectId = resolveProjectId(selectedProjectId);
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
      resolveProjectId,
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
  // #404 锚定页（project）：live 未决退空集（不退 canon 幻影行），锚行
  // 置首——dialog 未动选择的默认行 = rows[0] = 本页路由项目（#305 律，
  // fixture 面同律）。
  const projectRows = useMemo(() => {
    let rows: { id: string; name: string }[] | undefined;
    if (live) {
      rows =
        anchorProjectId === undefined
          ? projectsQ.data?.map((p) => ({ id: p.id, name: p.name }))
          : (projectsQ.data ?? []).map((p) => ({ id: p.id, name: p.name }));
    } else if (fixture.projectNames != null) {
      rows = Object.entries(fixture.projectNames).map(([id, name]) => ({ id, name }));
    }
    if (rows !== undefined && anchorProjectId !== undefined) {
      rows = [
        ...rows.filter((row) => row.id === anchorProjectId),
        ...rows.filter((row) => row.id !== anchorProjectId),
      ];
    }
    return rows;
  }, [live, projectsQ.data, fixture.projectNames, anchorProjectId]);

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
    ...(live ? { spec: liveSpec, onSpecChange: setLiveSpec, onAttachment } : {}),
    ...(mentions ? { mentionGroups } : {}),
  };
  return { openDialog, firstAgentId, dialogProps };
}
