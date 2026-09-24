// Project route (issue #71): 任务|文件 tab group centered in the topbar
// (r2 24b/07e), project name left after the back chevron. 文件 = repo tree
// pane (branch chip + 文件|历史 segment + file rows, r2 07e/24) beside the
// 请选择一个文件查看 placeholder; 任务 = search/filter/sort toolbar + view
// toggle + todo rows (r2 26) or the 暂无内容 empty state (r2 24b).
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useProjectCommits, useProjects, useProjectTree, useTodos } from '../api/hooks.js';
import { mapCommits, toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { relativeTime } from '../board/rel-time.js';
import type { ProjectCommitRow, ProjectContent } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import {
  ArrowUpDown,
  ChevronDown,
  FileTab,
  Funnel,
  GitCommit,
  Grid2x2,
  ListLines,
  PlusSmall,
  Search,
} from '../icons/index.js';
import { PageShell } from './shell.js';
import './pages.css';

function FilesPane({
  branch,
  files,
  seg,
  onSeg,
  commits,
  now,
}: {
  branch: string;
  files: string[];
  seg: 'files' | 'history';
  onSeg: (seg: 'files' | 'history') => void;
  commits: ProjectCommitRow[];
  now: number;
}) {
  const { t } = useI18n();
  return (
    <div className="prj-files-pane">
      <div className="prj-files-head">
        {/* 分支 chip = 静态展示（#149 裁决，[设计]）：托管 repo 读面固定
            defaultBranch（tree?ref=main），无切分支行为预期；chevron 保
            r2 07e 捕获形状。非交互元素——不再是死钮。 */}
        <span className="prj-branch-chip">
          {branch}
          <ChevronDown width={12} height={12} />
        </span>
        {/* 「导出」钮全除（#149 wontfix）：无导出后端面，local-first 裁决
            （#129 先例），台账 #136 勾兑登记。 */}
      </div>
      <div className="prj-files-seg">
        <button
          type="button"
          className={`prj-files-seg-tab${seg === 'files' ? ' prj-files-seg-tab--active' : ''}`}
          onClick={() => onSeg('files')}
        >
          {t('文件')}
        </button>
        <button
          type="button"
          className={`prj-files-seg-tab${seg === 'history' ? ' prj-files-seg-tab--active' : ''}`}
          onClick={() => onSeg('history')}
        >
          {t('历史')}
        </button>
      </div>
      {seg === 'files' ? (
        <div className="prj-files-list">
          {files.map((f) => (
            <button key={f} type="button" className="prj-file-row">
              <FileTab width={14} height={14} />
              <span className="prj-file-name">{f}</span>
            </button>
          ))}
        </div>
      ) : commits.length === 0 ? (
        <div className="prj-history-empty">{t('尚无提交历史。')}</div>
      ) : (
        // 历史行形 [设计]（官方历史面无捕获）：git log 最小投影，新→旧
        <div className="prj-history-list">
          {commits.map((c) => (
            <div className="prj-history-row" key={c.id}>
              <GitCommit width={14} height={14} />
              <span className="prj-history-text">
                <span className="prj-history-msg">{c.message}</span>
                <span className="prj-history-meta">
                  {c.authorName} · {relativeTime(c.at, now, t)} · {c.shortSha}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TasksPane({
  todos,
  now,
}: {
  todos: { id: string; title: string; phaseAt: number }[];
  now: number;
}) {
  const { t } = useI18n();
  return (
    <div className="prj-tasks-pane">
      <div className="prj-tasks-toolbar">
        <div className="prj-tasks-search">
          <Search width={14} height={14} />
          <input type="text" placeholder={t('搜索任务…')} aria-label={t('搜索任务')} />
        </div>
        <button type="button" className="prj-tasks-filter">
          <Funnel />
          {t('筛选')}
          <ChevronDown width={12} height={12} />
        </button>
        <button type="button" className="prj-tasks-filter">
          <ArrowUpDown />
          {t('排序')}
          <ChevronDown width={12} height={12} />
        </button>
        <div className="prj-tasks-view">
          <button
            type="button"
            className="prj-tasks-view-btn prj-tasks-view-btn--active"
            aria-label={t('列表视图')}
          >
            <ListLines />
          </button>
          <button type="button" className="prj-tasks-view-btn" aria-label={t('网格视图')}>
            <Grid2x2 width={14} height={14} />
          </button>
        </div>
      </div>
      {todos.length === 0 ? (
        <div className="prj-tasks-empty">
          <div className="prj-tasks-empty-tile">
            <ListLines width={20} height={20} />
          </div>
          <div className="prj-tasks-empty-title">{t('暂无内容')}</div>
          <div className="prj-tasks-empty-desc">{t('创建第一个任务以开始使用。')}</div>
          <button type="button" className="prj-tasks-empty-new">
            <PlusSmall width={12} height={12} />
            {t('任务')}
          </button>
        </div>
      ) : (
        <div className="prj-tasks-list">
          {todos.map((todo) => (
            <div key={todo.id} className="prj-task-row">
              <span className="prj-task-check" aria-hidden="true" />
              <span className="prj-task-title">{todo.title}</span>
              <span className="prj-task-time">{relativeTime(todo.phaseAt, now, t)}</span>
              <span className="prj-task-avatar">
                <img src="/avatar-user.png" alt="" />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  // r2 §2 route table: ?tab=tasks selects the 任务 surface; the capture
  // state flag drives parity rows (same precedent as the detail tabs).
  const [tab, setTab] = useState<'tasks' | 'files'>(
    searchParams.get('tab') === 'tasks' ? 'tasks' : (fixture.projectTab ?? 'files'),
  );
  // 文件|历史 分段（#149 接线）：历史 = 提交历史读面（live 走
  // projects/{id}/commits [推断] 端点；fixture 走 ProjectContent.commits）。
  const [seg, setSeg] = useState<'files' | 'history'>('files');
  // M5 live：项目行 = GET /api/projects 检索；文件树 = GET tree（02 §3
  // 读裸库面）；任务列表 = 真 todos 按 projectId 过滤。
  const { live, teamId } = useLiveData();
  const projectsQ = useProjects(teamId, live);
  const todosQ = useTodos(teamId, live);
  const treeQ = useProjectTree(live ? id : undefined, live ? 'main' : undefined);
  const wireProject = live ? (projectsQ.data ?? []).find((p) => p.id === id) : undefined;
  // 历史读面惰性：仅 live + 文件 tab + 历史 seg + 托管形态才发（GitHub
  // 接入无本地存储面 = tree/file 同族 404，不发无谓请求）。
  const commitsQ = useProjectCommits(
    live ? id : undefined,
    live && tab === 'files' && seg === 'history' && wireProject?.repoKind === 'hosted',
  );
  const project: ProjectContent | undefined = live
    ? wireProject
      ? {
          name: wireProject.name,
          branch: 'main',
          files: (treeQ.data?.entries ?? []).map((e) => e.name),
          repoName: wireProject.repoName ?? wireProject.githubRepo ?? '',
          hosted: wireProject.repoKind === 'hosted',
          defaultBranch: 'main',
          description: null,
        }
      : undefined
    : fixture.project;
  const todos = live
    ? (todosQ.data ?? []).map(toDisplayTodo).filter((x) => x.projectId === id)
    : fixture.todos.filter((x) => x.projectId === id);
  return (
    <PageShell
      fixture={live ? { ...fixture, todos } : fixture}
      selected="project"
      leftTitle={project?.name ?? ''}
      tabs={[
        { id: 'tasks', label: '任务' },
        { id: 'files', label: '文件' },
      ]}
      tab={tab}
      onTab={(next) => setTab(next === 'tasks' ? 'tasks' : 'files')}
    >
      {tab === 'files' ? (
        <div className="prj-files">
          <FilesPane
            branch={project?.branch ?? 'main'}
            files={project?.files ?? []}
            seg={seg}
            onSeg={setSeg}
            commits={live ? mapCommits(commitsQ.data?.commits ?? []) : (project?.commits ?? [])}
            now={live ? Date.now() : fixture.now}
          />
          <div className="prj-files-viewer">{t('请选择一个文件查看')}</div>
        </div>
      ) : (
        <TasksPane todos={todos} now={live ? Date.now() : fixture.now} />
      )}
    </PageShell>
  );
}
