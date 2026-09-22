// Project route (issue #71): 任务|文件 tab group centered in the topbar
// (r2 24b/07e), project name left after the back chevron. 文件 = repo tree
// pane (branch chip + 文件|历史 segment + file rows, r2 07e/24) beside the
// 请选择一个文件查看 placeholder; 任务 = search/filter/sort toolbar + view
// toggle + todo rows (r2 26) or the 暂无内容 empty state (r2 24b).
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { relativeTime } from '../board/rel-time.js';
import { resolveScenario } from '../fixtures/scenario.js';
import {
  ArrowUpDown,
  ChevronDown,
  ChiefFab,
  FileTab,
  Funnel,
  Grid2x2,
  ListLines,
  PlusSmall,
  Search,
  Upload,
} from '../icons/index.js';
import { PageShell } from './shell.js';
import './pages.css';

function FilesPane({ branch, files }: { branch: string; files: string[] }) {
  return (
    <div className="prj-files-pane">
      <div className="prj-files-head">
        <button type="button" className="prj-branch-chip">
          {branch}
          <ChevronDown width={12} height={12} />
        </button>
        <button type="button" className="prj-files-share" aria-label="导出">
          <Upload />
        </button>
      </div>
      <div className="prj-files-seg">
        <button type="button" className="prj-files-seg-tab prj-files-seg-tab--active">
          文件
        </button>
        <button type="button" className="prj-files-seg-tab">
          历史
        </button>
      </div>
      <div className="prj-files-list">
        {files.map((f) => (
          <button key={f} type="button" className="prj-file-row">
            <FileTab width={14} height={14} />
            <span className="prj-file-name">{f}</span>
          </button>
        ))}
      </div>
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
  return (
    <div className="prj-tasks-pane">
      <div className="prj-tasks-toolbar">
        <div className="prj-tasks-search">
          <Search width={14} height={14} />
          <input type="text" placeholder="搜索任务…" aria-label="搜索任务" />
        </div>
        <button type="button" className="prj-tasks-filter">
          <Funnel />
          筛选
          <ChevronDown width={12} height={12} />
        </button>
        <button type="button" className="prj-tasks-filter">
          <ArrowUpDown />
          排序
          <ChevronDown width={12} height={12} />
        </button>
        <div className="prj-tasks-view">
          <button
            type="button"
            className="prj-tasks-view-btn prj-tasks-view-btn--active"
            aria-label="列表视图"
          >
            <ListLines />
          </button>
          <button type="button" className="prj-tasks-view-btn" aria-label="网格视图">
            <Grid2x2 width={14} height={14} />
          </button>
        </div>
      </div>
      {todos.length === 0 ? (
        <div className="prj-tasks-empty">
          <div className="prj-tasks-empty-tile">
            <ListLines width={20} height={20} />
          </div>
          <div className="prj-tasks-empty-title">暂无内容</div>
          <div className="prj-tasks-empty-desc">创建第一个任务以开始使用。</div>
          <button type="button" className="prj-tasks-empty-new">
            <PlusSmall width={12} height={12} />
            任务
          </button>
        </div>
      ) : (
        <div className="prj-tasks-list">
          {todos.map((t) => (
            <div key={t.id} className="prj-task-row">
              <span className="prj-task-check" aria-hidden="true" />
              <span className="prj-task-title">{t.title}</span>
              <span className="prj-task-time">{relativeTime(t.phaseAt, now)}</span>
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
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  // r2 §2 route table: ?tab=tasks selects the 任务 surface; the capture
  // state flag drives parity rows (same precedent as the detail tabs).
  const [tab, setTab] = useState<'tasks' | 'files'>(
    searchParams.get('tab') === 'tasks' ? 'tasks' : (fixture.projectTab ?? 'files'),
  );
  const project = fixture.project;
  const todos = fixture.todos.filter((t) => t.projectId === id);
  return (
    <PageShell
      fixture={fixture}
      selected="project"
      leftTitle={project?.repoName ?? ''}
      tabs={[
        { id: 'tasks', label: '任务' },
        { id: 'files', label: '文件' },
      ]}
      tab={tab}
      onTab={(next) => setTab(next === 'tasks' ? 'tasks' : 'files')}
    >
      {tab === 'files' ? (
        <div className="prj-files">
          <FilesPane branch={project?.branch ?? 'main'} files={project?.files ?? []} />
          <div className="prj-files-viewer">请选择一个文件查看</div>
        </div>
      ) : (
        <TasksPane todos={todos} now={fixture.now} />
      )}
      <button type="button" className="page-fab" aria-label="总管">
        <ChiefFab />
      </button>
    </PageShell>
  );
}
