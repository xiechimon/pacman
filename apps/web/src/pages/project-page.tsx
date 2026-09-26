// Project route (issue #71): 任务|文件 tab group centered in the topbar
// (r2 24b/07e), project name left after the back chevron. 文件 = repo tree
// pane (branch chip + 文件|历史 segment + file rows, r2 07e/24) beside the
// 请选择一个文件查看 placeholder; 任务 = search/filter/sort toolbar + view
// toggle + todo rows (r2 26) or the 暂无内容 empty state (r2 24b).
// #178: the toolbar is live — the list|grid toggle persists through the
// registered client-state key (pacman.projectTasksLayout, the
// teamMembersLayout twin), 筛选/排序 open anchored popovers (family law
// #67/#127) driving client-side filter/sort, and the search box filters
// by title.
import type { ProjectFileResponse } from '@pacman/shared';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import {
  useProjectCommits,
  useProjectFile,
  useProjects,
  useProjectTree,
  useTodos,
} from '../api/hooks.js';
import { mapCommits, toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { relativeTime } from '../board/rel-time.js';
import type { Phase, ProjectCommitRow, ProjectContent } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  FileTab,
  Funnel,
  GitCommit,
  Grid2x2,
  ListLines,
  PlusSmall,
  Search,
} from '../icons/index.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from '../overlays/dismiss.js';
import { Button } from '../ui/button.js';
import { PageShell } from './shell.js';
import './pages.css';

function FilesPane({
  branch,
  files,
  seg,
  onSeg,
  commits,
  now,
  selectedFile,
  onSelectFile,
}: {
  branch: string;
  files: string[];
  seg: 'files' | 'history';
  onSeg: (seg: 'files' | 'history') => void;
  commits: ProjectCommitRow[];
  now: number;
  /** #202 查看器选中文件;null = 未选。 */
  selectedFile: string | null;
  onSelectFile: (name: string) => void;
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
            <button
              key={f}
              type="button"
              className={`prj-file-row${selectedFile === f ? ' prj-file-row--active' : ''}`}
              onClick={() => onSelectFile(f)}
            >
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

/** #178 view-switch client-state key, [推断] same shape as the r2 §1.5
 *  observed pacman.teamMembersLayout (registered in shared
 *  protocol/client-state.ts); absent = list. */
export const PROJECT_TASKS_LAYOUT_STORAGE_KEY = 'pacman.projectTasksLayout';

type TasksLayout = 'list' | 'grid';
type TaskFilter = 'all' | 'active' | 'done';
type TaskSort = 'default' | 'recent' | 'title';

interface TaskRow {
  id: string;
  title: string;
  phase: Phase;
  phaseAt: number;
}

/** 文件查看器状态(#202):idle = 占位;loading/error 仅 live 可达;
 *  binary = 不可预览态(live base64 封套 / fixture 缺内容映射);text 直渲。 */
type FileViewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'binary' }
  | { kind: 'text'; content: string };

/** 查看器状态推导(#202,code-review 抽取):fixture 直读 fileContents
 *  映射(缺席键 = 不可预览态);live 折 query 三态后按 encoding 分渲。
 *  结构子集传参,不绑 useQuery 全形。 */
function deriveFileView(
  selected: string | null,
  live: boolean,
  fixtureContent: string | null,
  file: { isError: boolean; data: ProjectFileResponse | undefined },
): FileViewState {
  if (selected === null) return { kind: 'idle' };
  if (!live) {
    return fixtureContent !== null ? { kind: 'text', content: fixtureContent } : { kind: 'binary' };
  }
  if (file.isError) return { kind: 'error' };
  if (file.data === undefined) return { kind: 'loading' };
  return file.data.encoding === 'base64'
    ? { kind: 'binary' }
    : { kind: 'text', content: file.data.content };
}

function readStoredLayout(storage: Storage): TasksLayout {
  return storage.getItem(PROJECT_TASKS_LAYOUT_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
}

/** 筛选最小集 [推断]（票面：全部/进行中/已完成，核 phase 九值）：已完成
 *  = done 单值（02 §4.1「已接受，若选了则已合并」）；进行中 = 其余八值
 *  ——closed「未完成即搁置」归未完成侧，不造第三档。 */
function filterOk(phase: Phase, filter: TaskFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'done') return phase === 'done';
  return phase !== 'done';
}

/** 排序三值 [推断]：默认 = 数据源序（fixture 冻结序 / server 返回序），
 *  最近更新 = phaseAt 降序（行面相对时间的数据同源），标题 = 升序。 */
function sortTodos(rows: TaskRow[], sort: TaskSort): TaskRow[] {
  if (sort === 'recent') return [...rows].sort((a, b) => b.phaseAt - a.phaseAt);
  if (sort === 'title') return [...rows].sort((a, b) => a.title.localeCompare(b.title, 'zh'));
  return rows;
}

const TASK_FILTERS: { id: TaskFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'active', label: '进行中' },
  { id: 'done', label: '已完成' },
];

const TASK_SORTS: { id: TaskSort; label: string }[] = [
  { id: 'default', label: '默认' },
  { id: 'recent', label: '最近更新' },
  { id: 'title', label: '标题' },
];

/** Anchored selection menu (#67/#127 family law): retained-mount exit via
 *  OverlayMount, transparent ClickCatcher + Escape close, plan-dropdown
 *  row shape (check rides the selected option only); picking an option
 *  both selects and closes. Geometry [设计] — no capture exercises the
 *  toolbar dropdowns. */
function TasksMenu<T extends string>({
  label,
  options,
  value,
  onSelect,
  onClose,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onSelect: (id: T) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="prj-tasks-menu anim-pop" role="listbox" aria-label={t(label)}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="prj-tasks-menu-row"
          role="option"
          aria-selected={option.id === value}
          onClick={() => {
            onSelect(option.id);
            onClose();
          }}
        >
          {t(option.label)}
          {option.id === value && (
            <span className="prj-tasks-menu-check">
              <Check width={14} height={14} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** 筛选/排序 trigger + its anchored menu: one component per dropdown so
 *  the open state, the Escape wiring and the relative anchor span travel
 *  together (the chip-popover / board-guide recipe). */
function TasksMenuButton<T extends string>({
  icon,
  label,
  options,
  value,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onSelect: (id: T) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEscapeClose(open, close);
  return (
    <span className="prj-tasks-menu-wrap">
      <button
        type="button"
        className="prj-tasks-filter"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
        {t(label)}
        <ChevronDown width={12} height={12} />
      </button>
      <OverlayMount open={open}>
        <ClickCatcher onClose={close} />
        <TasksMenu
          label={label}
          options={options}
          value={value}
          onSelect={onSelect}
          onClose={close}
        />
      </OverlayMount>
    </span>
  );
}

function TasksPane({ todos, now }: { todos: TaskRow[]; now: number }) {
  const { t } = useI18n();
  // #318: 行/卡点击 = 导航任务详情(r2 §2 原站点行开详情);search 随行
  // 携带(fixture 面 scenario 参数不丢,todo-card #58 同律)。
  const { search } = useLocation();
  const [layout, setLayout] = useState<TasksLayout>(() => readStoredLayout(localStorage));
  const switchLayout = useCallback((next: TasksLayout) => {
    setLayout(next);
    localStorage.setItem(PROJECT_TASKS_LAYOUT_STORAGE_KEY, next);
  }, []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [sort, setSort] = useState<TaskSort>('default');
  // 客户端过滤/排序（票面裁决：数据面 todos 已在页内，无服务端往返）
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = todos.filter(
      (todo) =>
        filterOk(todo.phase, filter) &&
        (needle === '' || todo.title.toLowerCase().includes(needle)),
    );
    return sortTodos(rows, sort);
  }, [todos, query, filter, sort]);
  return (
    <div className="prj-tasks-pane">
      <div className="prj-tasks-toolbar">
        <div className="prj-tasks-search">
          <Search width={14} height={14} />
          <input
            type="text"
            placeholder={t('搜索任务…')}
            aria-label={t('搜索任务')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <TasksMenuButton
          icon={<Funnel />}
          label="筛选"
          options={TASK_FILTERS}
          value={filter}
          onSelect={setFilter}
        />
        <TasksMenuButton
          icon={<ArrowUpDown />}
          label="排序"
          options={TASK_SORTS}
          value={sort}
          onSelect={setSort}
        />
        <div className="prj-tasks-view" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={layout === 'list'}
            className={`prj-tasks-view-btn${layout === 'list' ? ' prj-tasks-view-btn--active' : ''}`}
            aria-label={t('列表视图')}
            onClick={() => switchLayout('list')}
          >
            <ListLines />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={layout === 'grid'}
            className={`prj-tasks-view-btn${layout === 'grid' ? ' prj-tasks-view-btn--active' : ''}`}
            aria-label={t('网格视图')}
            onClick={() => switchLayout('grid')}
          >
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
          <Button variant="primary" size="compact" className="prj-tasks-empty-new">
            <PlusSmall width={12} height={12} />
            {t('任务')}
          </Button>
        </div>
      ) : visible.length === 0 ? (
        // 筛选/搜索清空 ≠ 项目无任务：给匹配空态一行，不误用 r2 24b 的
        // 「创建第一个任务」空态（那是无 todo 项目的 canon）
        <div className="prj-tasks-nomatch">{t('没有匹配的任务')}</div>
      ) : layout === 'list' ? (
        <div className="prj-tasks-list">
          {visible.map((todo) => (
            <div key={todo.id} className="prj-task-row">
              <span className="prj-task-check" aria-hidden="true" />
              {/* #318: 标题是真 <a>,::after 拉伸盖满整行 = 点行开详情
                  (todo-card-link #58 同款,行内无其它交互件无需抬 z) */}
              <Link
                className="prj-task-title prj-task-link"
                to={{ pathname: `/app/todo/${todo.id}`, search }}
              >
                {todo.title}
              </Link>
              <span className="prj-task-time">{relativeTime(todo.phaseAt, now, t)}</span>
              <span className="prj-task-avatar">
                <img src="/avatar-user.png" alt="" />
              </span>
            </div>
          ))}
        </div>
      ) : (
        // 网格形 [设计]（票面注记：官方无捕获）——卡语言贴 team-agent-card
        // （surface tile + 标题）＋本行原子（勾选圈/相对时间/头像）
        <div className="prj-tasks-grid">
          {visible.map((todo) => (
            <div key={todo.id} className="prj-task-card">
              <div className="prj-task-card-head">
                <span className="prj-task-check" aria-hidden="true" />
                <span className="prj-task-avatar">
                  <img src="/avatar-user.png" alt="" />
                </span>
              </div>
              {/* #318: 同列表行——标题 <a> 的 ::after 拉伸盖满整卡 */}
              <Link
                className="prj-task-card-title prj-task-link"
                to={{ pathname: `/app/todo/${todo.id}`, search }}
              >
                {todo.title}
              </Link>
              <span className="prj-task-card-time">{relativeTime(todo.phaseAt, now, t)}</span>
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
  // 文件查看器选中态(#202):存 (projectId, path) 对——路由切换项目时
  // 组件不重挂载,旧项目选中不串场。live 读面点击触发 = 天然惰性;非托管
  // 形态 tree 同族 404 无行可点,误点落「文件加载失败」诚实态,不做
  // 形态门(code-review:门会让 query 永久 disabled = 永挂 loading)。
  const [fileSel, setFileSel] = useState<{ projectId: string; path: string } | null>(null);
  const selectedFile = fileSel !== null && fileSel.projectId === id ? fileSel.path : null;
  const fileQ = useProjectFile(
    live ? id : undefined,
    selectedFile ?? undefined,
    live ? 'main' : undefined,
  );
  const fixtureFileContent =
    !live && selectedFile !== null ? (fixture.project?.fileContents?.[selectedFile] ?? null) : null;
  const fileView = deriveFileView(selectedFile, live, fixtureFileContent, fileQ);
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
            selectedFile={selectedFile}
            onSelectFile={(name) => setFileSel({ projectId: id ?? '', path: name })}
          />
          {fileView.kind === 'text' ? (
            <div className="prj-files-viewer prj-files-viewer--text">
              <pre className="prj-file-content">{fileView.content}</pre>
            </div>
          ) : (
            <div className="prj-files-viewer">
              {fileView.kind === 'loading'
                ? t('加载中…')
                : fileView.kind === 'error'
                  ? t('文件加载失败')
                  : fileView.kind === 'binary'
                    ? t('二进制文件暂不支持预览')
                    : t('请选择一个文件查看')}
            </div>
          )}
        </div>
      ) : (
        <TasksPane todos={todos} now={live ? Date.now() : fixture.now} />
      )}
    </PageShell>
  );
}
