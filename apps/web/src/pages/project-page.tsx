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
import {
  LOCAL_ERROR_REASON_COPY,
  type LocalErrorReason,
  type ProjectFileResponse,
} from '@pacman/shared';
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../api/client.js';
import {
  useGithubConnection,
  useProjectCommits,
  useProjectFile,
  useProjects,
  useProjectTree,
  useTodos,
} from '../api/hooks.js';
import { mapCommits, toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { relativeTime } from '../board/rel-time.js';
import { Button } from '../components/ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu.js';
import { Input } from '../components/ui/input.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { localTodo } from '../fixtures/fixtures.js';
import type { Phase, ProjectCommitRow, ProjectContent, TodoRecord } from '../fixtures/records.js';
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
import { type NewTaskSurfaceApi, NewTaskSurfaceRoot } from '../overlay/new-task-surface-root.js';
import { GithubIssuesDialog } from './github-issues-dialog.js';
import {
  GHOST_SEG_BTN_CLS,
  SEG_GROUP_CLS,
  SEG_TAB_ACTIVE_CLS,
  SEG_TAB_CLS,
  SEG_TAB_IDLE_CLS,
} from './parts.js';
import { PageShell } from './shell.js';

/* #946 per-face 清零：原 pages.css 的 prj-* 规则组等值迁 utility 配方。
   类名留存原则——跨域 spec 的定位别名（dead-buttons / segmented-controls /
   avatar-dicebear 钉 .prj-file-row / .prj-history-row / .prj-files-seg-tab
   (+--active) / .prj-branch-chip / .prj-task-row|-card|-link /
   .prj-tasks-view-btn / .prj-files / .prj-task-avatar）原样透传，皮肤已全部
   由 utility 承载；本域 spec 已重钉语义载体，其余类名摘除归 #952/#953 终账。 */

/** 筛选/排序触发钮与 issue 入口共用的 chip 盒形（原 .prj-tasks-filter）：
 *  28 高带框、13 字号、secondary 墨，末位 chevron tertiary（#946
 *  better-colors 实测换槽：--text-dim 亮模在抬升面 2.73–2.89 < 3，见
 *  docs/verify/946/contrast-946.md）；ghost 七通道中和 +
 *  aria-expanded 通道（触发钮有 haspopup 面，底色/墨色钉回静息值）。 */
const TOOLBAR_CHIP_CLS =
  "h-7 cursor-pointer gap-1.5 rounded-none border border-(--border) bg-transparent px-3 text-[13px] font-normal leading-[inherit] text-(--text-secondary) hover:bg-transparent hover:text-(--text-secondary) dark:hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-(--text-secondary) active:not-aria-[haspopup]:translate-y-0 [&_svg:last-of-type]:text-(--text-tertiary) [&_svg:not([class*='size-'])]:size-auto";

/** 菜单盘（原 .prj-tasks-menu，plan-dropdown family plate）：shrink-to-fit
 *  ≥148（w-auto 中和 base 的 w-(--anchor-width)）、popover 底、radius 12、
 *  fab 影；勾色品牌紫走 indicator 槽选择器（#944 RES_SORT_ROW_CLS 同形）。 */
const TASKS_MENU_CLS =
  'w-auto min-w-[148px] rounded-(--radius-popover) bg-(--popover) p-1 shadow-(--fab-shadow) ring-0 [&_[data-slot=dropdown-menu-radio-item-indicator]]:text-(--card-button)';

/** 菜单行（原 .prj-tasks-menu-row）：28 高 / 12 字 / 透明底——行面无 hover
 *  涂底（focus:bg 中和回透明，与收编前一致）；键盘 roving focus 的可见环按
 *  #388 同配方补钉（行是 div[role=menuitemradio]，不在全局环名单）。 */
const TASKS_MENU_ROW_CLS =
  'h-7 w-full cursor-pointer rounded-[8px] py-0 pr-2 pl-3 text-left text-xs leading-4 text-(--foreground) focus:bg-transparent focus:text-(--foreground) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)';

/** 视图切换钮（原 .prj-tasks-view-btn，#138 seg 家族成员）：28×24 图标盒，
 *  选中 = tab-chip 填充 + primary 墨（载体 aria-selected），未选 hover =
 *  seg-hover 淡 tint。 */
const VIEW_BTN_CLS =
  "h-6 w-7 cursor-pointer rounded-none border-none bg-transparent px-0 text-(--text-tertiary) transition-[background-color] duration-(--dur-fast) ease-(--ease-standard) font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto";
const VIEW_BTN_IDLE_CLS =
  'hover:bg-(--seg-hover) hover:text-(--text-tertiary) dark:hover:bg-(--seg-hover)';
const VIEW_BTN_ACTIVE_CLS =
  'bg-(--card) text-(--foreground) hover:bg-(--card) hover:text-(--foreground) dark:hover:bg-(--card)';

/** 文件树行钮（原 .prj-file-row）：30 高透明行，选中 = surface-hover 填充
 *  （载体 aria-current；--active 类名留存 = dead-buttons 跨域别名）。 */
const FILE_ROW_CLS =
  'h-[30px] w-full cursor-pointer justify-start gap-2 rounded-none border-none bg-transparent px-1 font-normal leading-[inherit] hover:bg-transparent dark:hover:bg-transparent active:not-aria-[haspopup]:translate-y-0 [&_svg]:flex-none [&_svg]:text-(--text-tertiary)';
const FILE_ROW_ACTIVE_CLS = 'bg-(--secondary) hover:bg-(--secondary) dark:hover:bg-(--secondary)';

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
    <div className="flex w-[276px] flex-none flex-col border-r border-(--border) py-2 pr-2 pl-4">
      <div className="flex items-center justify-between pr-2">
        {/* 分支 chip = 静态展示（#149 裁决，[设计]）：托管 repo 读面固定
            defaultBranch（tree?ref=main），无切分支行为预期；chevron 保
            r2 07e 捕获形状。非交互元素——不再是死钮。 */}
        <span className="prj-branch-chip flex h-7 items-center gap-1.5 rounded-[6px] bg-(--secondary) px-2.5 font-mono text-xs text-(--text-secondary) [&_svg]:text-(--text-tertiary)">
          {branch}
          <ChevronDown width={12} height={12} />
        </span>
        {/* 「导出」钮全除（#149 wontfix）：无导出后端面，local-first 裁决
            （#129 先例），台账 #136 勾兑登记。 */}
      </div>
      <div className={`mt-2 w-fit ${SEG_GROUP_CLS}`}>
        {/* XMON-25 收编：ghost；#946：13/24 字体与几何迁 SEG_* 配方（发丝环
            家族 #138），--active 类名留存（dead-buttons / segmented-controls
            跨域别名），选中皮肤 = tab-chip 填充 utility。 */}
        <Button
          variant="ghost"
          className={`prj-files-seg-tab ${SEG_TAB_CLS} ${GHOST_SEG_BTN_CLS} ${
            seg === 'files' ? `prj-files-seg-tab--active ${SEG_TAB_ACTIVE_CLS}` : SEG_TAB_IDLE_CLS
          }`}
          onClick={() => onSeg('files')}
        >
          {t('文件')}
        </Button>
        <Button
          variant="ghost"
          className={`prj-files-seg-tab ${SEG_TAB_CLS} ${GHOST_SEG_BTN_CLS} ${
            seg === 'history' ? `prj-files-seg-tab--active ${SEG_TAB_ACTIVE_CLS}` : SEG_TAB_IDLE_CLS
          }`}
          onClick={() => onSeg('history')}
        >
          {t('历史')}
        </Button>
      </div>
      {seg === 'files' ? (
        <div className="mt-3">
          {files.map((f) => (
            // XMON-25 收编：ghost；#946：行皮肤迁 FILE_ROW_CLS 配方，选中态
            // 载体 = aria-current（#910 裁定 3），size-auto 保 FileTab 的
            // 14px 属性尺寸（base 会强制 16）。
            <Button
              key={f}
              variant="ghost"
              aria-current={selectedFile === f ? 'true' : undefined}
              className={`prj-file-row ${FILE_ROW_CLS} [&_svg:not([class*='size-'])]:size-auto${
                selectedFile === f ? ` ${FILE_ROW_ACTIVE_CLS}` : ''
              }`}
              onClick={() => onSelectFile(f)}
            >
              <FileTab width={14} height={14} />
              <span className="font-mono text-xs text-(--text-secondary)">{f}</span>
            </Button>
          ))}
        </div>
      ) : commits.length === 0 ? (
        <div className="mt-3 px-1 py-6 text-center text-xs text-(--text-tertiary)">
          {t('尚无提交历史。')}
        </div>
      ) : (
        // 历史行形 [设计]（官方历史面无捕获）：git log 最小投影，新→旧
        <ul className="mt-3">
          {commits.map((c) => (
            <li
              className="prj-history-row flex w-full items-center gap-2 px-1 py-[5px] [&_svg]:flex-none [&_svg]:text-(--text-tertiary)"
              key={c.id}
            >
              <GitCommit width={14} height={14} />
              <span className="flex min-w-0 flex-col gap-px">
                <span className="truncate text-xs leading-4 text-(--foreground)">{c.message}</span>
                <span className="font-mono text-[11px] leading-[14px] text-(--text-tertiary)">
                  {c.authorName} · {relativeTime(c.at, now, t)} · {c.shortSha}
                </span>
              </span>
            </li>
          ))}
        </ul>
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

/** 筛选/排序选项组：t-0070 收编到 components/ui/dropdown-menu（Base UI
 *  Menu RadioGroup）。单选即关走显式 closeOnClick——RadioItem 缺省是
 *  false（原生菜单 radio 保开语义），本面家族律是 select-and-close
 *  （#306）；勾形只骑选中项 = RadioItemIndicator 原生律（原「check
 *  rides the selected option」手搓等价）；roving focus / typeahead /
 *  Esc / 外点关 / 焦点归还全归原语。行皮肤/几何正本在 per-face
 *  .prj-tasks-menu-row（28 高/12px 字/透明底——unlayered 恒胜 base 的
 *  focus:bg-accent，行面无 hover 增亮与收编前一致）；勾色正本
 *  （indigo-500）钉 per-face 的 indicator 槽选择器；size-auto 中和 base
 *  强制 size-4，保 Check 14px 属性尺寸（#607 机理）。
 *  Geometry [设计] — no capture exercises the toolbar dropdowns. */
function TasksMenu<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: { id: T; label: string }[];
  value: T;
  onSelect: (id: T) => void;
}) {
  const { t } = useI18n();
  return (
    <DropdownMenuRadioGroup value={value} onValueChange={(next) => onSelect(next as T)}>
      {options.map((option) => (
        <DropdownMenuRadioItem
          key={option.id}
          value={option.id}
          closeOnClick
          className={`${TASKS_MENU_ROW_CLS} [&_svg:not([class*='size-'])]:size-auto`}
        >
          {t(option.label)}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

/** 筛选/排序 trigger + its anchored menu: one component per dropdown so
 *  the trigger and its popup travel together. 定位正本从 CSS inset 迁到
 *  Positioner 参数（side=bottom align=start sideOffset=6 = 原
 *  top:calc(100%+6px) left:0 贴 wrap）；w-auto 中和 base 的
 *  w-(--anchor-width)——plate 宽正本 = shrink-to-fit ≥ per-face
 *  min-width，不跟 trigger 宽。trigger 的 aria-haspopup/aria-expanded 与
 *  toggle 开合归 Trigger/Root（#666 的双写竞态面就此消失）；XMON-25 的
 *  ghost 收编注释照旧：size-auto 保 Funnel 14 / ChevronDown 12 属性尺寸，
 *  haspopup 使 base active 位移自动跳过，aria-expanded 底色档被 per-face
 *  bg 简写（unlayered）压掉 = 零漂移。 */
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
  return (
    <DropdownMenu>
      <span className="relative flex">
        <DropdownMenuTrigger render={<Button variant="ghost" className={TOOLBAR_CHIP_CLS} />}>
          {icon}
          {t(label)}
          <ChevronDown width={12} height={12} />
        </DropdownMenuTrigger>
      </span>
      <DropdownMenuContent sideOffset={6} aria-label={t(label)} className={TASKS_MENU_CLS}>
        <TasksMenu options={options} value={value} onSelect={onSelect} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TasksPane({
  todos,
  now,
  onNewTask,
  onOpenGithubIssues,
}: {
  todos: TaskRow[];
  now: number;
  /** #305: 空态「+ 任务」入口开 NewTaskDialog（与看板新建入口同构）。 */
  onNewTask: () => void;
  /** #446：github 形态 + 已连接时的「从 GitHub issue 建任务」入口开关；
   * 缺省 = 入口不渲染（local/hosted/fixture/未连接面零漂移）。 */
  onOpenGithubIssues?: () => void;
}) {
  const { t } = useI18n();
  // XMON-105: task-row owner avatar = the logged-in user identity single
  // source (same face as sidebar chip / account head / chat user rows).
  const { user } = useLiveData();
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center gap-3 px-4 py-3">
        <div className="flex h-7 flex-1 items-center gap-2 rounded-none border border-(--border) px-2.5 text-(--text-tertiary)">
          <Search width={14} height={14} />
          {/* XMON-25 收编：Input 原语；#946：本面 focus 皮肤 = 无环面
              （#388 前的既有行为）——件基类 outline-none + ring-0 掐掉
              focus ring、border-none 使 border-ring 档不可见；h-auto +
              leading-[inherit] 保内容高——preflight 对裸 input 置
              line-height: inherit，inherit 逐位复刻老面（text-sm 的比例
              行高会抬高）；p-0 钉零内距（盒形由外层搜索盒承载）。 */}
          <Input
            type="text"
            className="h-auto min-w-0 flex-1 rounded-none border-none bg-transparent p-0 text-[13px] leading-[inherit] text-(--foreground) placeholder:text-(--text-tertiary) focus-visible:ring-0 dark:bg-transparent md:leading-[inherit]"
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
        {onOpenGithubIssues !== undefined && (
          // XMON-25 收编：ghost 复用工具条 chip 盒形（TOOLBAR_CHIP_CLS 同源）。
          <Button variant="ghost" className={TOOLBAR_CHIP_CLS} onClick={onOpenGithubIssues}>
            {t('从 GitHub issue 建任务')}
          </Button>
        )}
        <div className={SEG_GROUP_CLS} role="tablist">
          {/* XMON-25 收编：ghost；#946：28×24 图标盒迁 VIEW_BTN 配方（#138
              seg 家族发丝环），size-auto 保 ListLines 16 / Grid2x2 14 属性
              尺寸；role=tab + aria-selected 由原语透传（选中态一级载体）。
              prj-tasks-view-btn 类名留存 = segmented-controls/dead-buttons
              跨域别名。 */}
          <Button
            variant="ghost"
            role="tab"
            aria-selected={layout === 'list'}
            className={`prj-tasks-view-btn ${VIEW_BTN_CLS} ${
              layout === 'list' ? VIEW_BTN_ACTIVE_CLS : VIEW_BTN_IDLE_CLS
            }`}
            aria-label={t('列表视图')}
            onClick={() => switchLayout('list')}
          >
            <ListLines />
          </Button>
          <Button
            variant="ghost"
            role="tab"
            aria-selected={layout === 'grid'}
            className={`prj-tasks-view-btn ${VIEW_BTN_CLS} ${
              layout === 'grid' ? VIEW_BTN_ACTIVE_CLS : VIEW_BTN_IDLE_CLS
            }`}
            aria-label={t('网格视图')}
            onClick={() => switchLayout('grid')}
          >
            <Grid2x2 width={14} height={14} />
          </Button>
        </div>
      </div>
      {todos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="flex size-12 items-center justify-center rounded-none bg-(--secondary) text-(--text-secondary)">
            <ListLines width={20} height={20} />
          </div>
          <div className="mt-4 text-sm font-semibold leading-5 text-(--foreground)">
            {t('暂无内容')}
          </div>
          <div className="mt-1 text-xs leading-4 text-(--text-tertiary)">
            {t('创建第一个任务以开始使用。')}
          </div>
          {/* XMON-25 收编：老 ui/Button primary/compact → brand 变体（等价
              迁移位）；compact 几何（28 高/12 内边距/13 字号）与 cursor 下沉
              per-face .prj-tasks-empty-new；size-auto 保 PlusSmall 12px。 */}
          <Button
            variant="brand"
            aria-label={t('新建任务')}
            className="mt-4 h-7 cursor-pointer gap-1 rounded-none border-none px-3 text-[13px] font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
            onClick={onNewTask}
          >
            <PlusSmall width={12} height={12} />
            {t('任务')}
          </Button>
        </div>
      ) : visible.length === 0 ? (
        // 筛选/搜索清空 ≠ 项目无任务：给匹配空态一行，不误用 r2 24b 的
        // 「创建第一个任务」空态（那是无 todo 项目的 canon）
        <div className="px-4 py-6 text-[13px] leading-4 text-(--text-tertiary)">
          {t('没有匹配的任务')}
        </div>
      ) : layout === 'list' ? (
        <div className="space-y-2 px-4">
          {visible.map((todo) => (
            <div
              key={todo.id}
              data-testid="task-row"
              className="prj-task-row relative flex h-9 items-center gap-3 rounded-none bg-(--secondary) px-3"
            >
              <span
                className="size-4 flex-none rounded-none border border-(--input)"
                aria-hidden="true"
              />
              {/* #318: 标题是真 <a>,after: 拉伸盖满整行 = 点行开详情
                  (todo-card-link #58 同款,行内无其它交互件无需抬 z) */}
              <Link
                className="prj-task-title prj-task-link min-w-0 flex-1 truncate text-[13px] leading-5 text-(--foreground) no-underline after:absolute after:inset-0 after:content-['']"
                to={{ pathname: `/app/todo/${todo.id}`, search }}
              >
                {todo.title}
              </Link>
              <span className="flex-none text-xs text-(--text-tertiary)">
                {relativeTime(todo.phaseAt, now, t)}
              </span>
              <span className="prj-task-avatar relative size-5 flex-none [&_img]:size-5 [&_img]:rounded-full after:absolute after:-right-px after:-bottom-px after:size-[7px] after:rounded-full after:border-[1.5px] after:border-(--card) after:bg-(--badge-idle) after:content-['']">
                <SeededAvatar
                  name={user.displayName}
                  src={user.avatarUrl}
                  fallback="/avatar-user.png"
                />
              </span>
            </div>
          ))}
        </div>
      ) : (
        // 网格形 [设计]（票面注记：官方无捕获）——卡语言贴 team-agent-card
        // （surface tile + 标题）＋本行原子（勾选圈/相对时间/头像）
        <div className="grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-2 px-4">
          {visible.map((todo) => (
            <div
              key={todo.id}
              data-testid="task-card"
              className="prj-task-card relative flex flex-col items-start gap-2 rounded-none bg-(--secondary) p-3"
            >
              <div className="flex items-center justify-between self-stretch">
                <span
                  className="size-4 flex-none rounded-none border border-(--input)"
                  aria-hidden="true"
                />
                <span className="prj-task-avatar relative size-5 flex-none [&_img]:size-5 [&_img]:rounded-full after:absolute after:-right-px after:-bottom-px after:size-[7px] after:rounded-full after:border-[1.5px] after:border-(--card) after:bg-(--badge-idle) after:content-['']">
                  <SeededAvatar
                    name={user.displayName}
                    src={user.avatarUrl}
                    fallback="/avatar-user.png"
                  />
                </span>
              </div>
              {/* #318: 同列表行——标题 <a> 的 after: 拉伸盖满整卡；两行截断 =
                  max-height 40 idiom（detail.css chat-preview 注同源）。 */}
              <Link
                className="prj-task-card-title prj-task-link max-h-10 overflow-hidden text-[13px] leading-5 text-(--foreground) no-underline after:absolute after:inset-0 after:content-['']"
                to={{ pathname: `/app/todo/${todo.id}`, search }}
              >
                {todo.title}
              </Link>
              <span className="text-xs text-(--text-tertiary)">
                {relativeTime(todo.phaseAt, now, t)}
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
  const navigate = useNavigate();
  const { search } = useLocation();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  // r2 §2 route table: ?tab=tasks selects the 任务 surface; the capture
  // state flag drives fixture rows (same precedent as the detail tabs).
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
  // fixture 面本地新行（board #66 同律）：保存落在客户端集合，页面/侧栏
  // 徽标都吃它；live 面走 mutation + invalidate，不用本地集。
  const [fixtureAdded, setFixtureAdded] = useState<TodoRecord[]>([]);
  // wireProject 先行（形态门数据源）；tree 对 hosted 与 local 形态发（#1030
  // 起 local 读面放行，server 侧目录解析分支；github 形态不发——404 静默 +
  // console 刷屏不可接受，不发无谓请求，文件面走诚实降级 + GitHub 外链）。
  // local 的 ref 不传（server 落 HEAD）：local 仓默认分支任意，hosted 的
  // ref='main' 是种子提交恒 main 的既约，不能外推到 local。
  const wireProject = live ? (projectsQ.data ?? []).find((p) => p.id === id) : undefined;
  const hostedRepo = live && wireProject?.repoKind === 'hosted';
  const localRepo = live && wireProject?.repoKind === 'local';
  const treeQ = useProjectTree(
    live && (hostedRepo || localRepo) ? id : undefined,
    hostedRepo ? 'main' : undefined,
  );
  // 历史读面惰性：仅 live + 文件 tab + 历史 seg + 可读形态（hosted/local）才发
  // （GitHub 接入无本地存储面 = tree/file 同族 404，不发无谓请求）。
  const commitsQ = useProjectCommits(
    live ? id : undefined,
    live && tab === 'files' && seg === 'history' && (hostedRepo || localRepo),
  );
  const project: ProjectContent | undefined = live
    ? wireProject
      ? {
          name: wireProject.name,
          // 分支 chip = 实读 ref 回显（hosted='main'、local='HEAD'——tree 载荷
          // 自带回显，不猜）；tree 未回时退 'main'（hosted 语义不变）。
          branch: treeQ.data?.ref ?? 'main',
          files: (treeQ.data?.entries ?? []).map((e) => e.name),
          repoName: wireProject.repoName ?? wireProject.githubRepo ?? '',
          hosted: wireProject.repoKind === 'hosted',
          ...(wireProject.repoKind !== undefined ? { repoKind: wireProject.repoKind } : {}),
          defaultBranch: 'main',
          description: null,
        }
      : undefined
    : fixture.project;
  // local 项目 Files tab 开闸（#1030，推翻 spec 12「v1 出局：Files tab 对 local
  // 禁用」的 out-of-scope）：server 端目录解析已分叉（requireRepoReadDir），
  // web 按形态发请求。不可达降级见下方 treeQ.isError 分支。
  const isLocalRepo = project?.repoKind === 'local';
  // 文件查看器选中态(#202):存 (projectId, path) 对——路由切换项目时
  // 组件不重挂载,旧项目选中不串场。live 读面点击触发 = 天然惰性;非托管
  // 形态 tree 同族 404 无行可点,误点落「文件加载失败」诚实态,不做
  // 形态门(code-review:门会让 query 永久 disabled = 永挂 loading)。
  const [fileSel, setFileSel] = useState<{ projectId: string; path: string } | null>(null);
  const selectedFile = fileSel !== null && fileSel.projectId === id ? fileSel.path : null;
  const fileQ = useProjectFile(
    live ? id : undefined,
    selectedFile ?? undefined,
    // ref 同 treeQ 口径：hosted 固定 'main'；local 落 HEAD（默认分支任意）。
    hostedRepo ? 'main' : undefined,
  );
  const fixtureFileContent =
    !live && selectedFile !== null ? (fixture.project?.fileContents?.[selectedFile] ?? null) : null;
  const fileView = deriveFileView(selectedFile, live, fixtureFileContent, fileQ);
  const todos = live
    ? (todosQ.data ?? []).map(toDisplayTodo).filter((x) => x.projectId === id)
    : [...fixture.todos, ...fixtureAdded].filter((x) => x.projectId === id);
  // 新建任务面：dialog 接线 = useNewTaskSurface（board/侧栏全局面同一 save
  // 路径）。本页差异走 hook 参数位——fixture 落点 = fixtureAdded 本地行
  // append（seqNum 基线 = scenario 集 + 已加行；canon projectId
  // approximation 同 #176 律）；锚 = 路由项目 id（#305 律：选择器行置首、
  // 保存缺省锚本页、不建默认项目）；提及面 = 空 picker；members eager
  // （查询面语义保持原状，#640 后保存并开始直发编排回合不再吃指派）。
  // spec 15 #394 同律：提交 = 正文单字段，标题 live 面 wire 空串 server
  // 派生、fixture 面 localTodo 内派生。
  const onFixtureSave = useCallback(
    (spec: string) => {
      setFixtureAdded((prev) => [
        ...prev,
        localTodo(
          [...fixture.todos, ...prev].reduce((max, t) => Math.max(max, t.seqNum), 0) + 1,
          spec,
          fixture.now,
        ),
      ]);
    },
    [fixture],
  );
  // XMON-93 隔离面：dialog 的 open/正文态住进 NewTaskSurfaceRoot 叶子内部，
  // 开合与输入不再整页重渲染（任务列表行同步重渲染 = ESC 退出卡顿的同源
  // 根因，board 面实测）。opener 走 ref 读，引用恒定。
  const newTaskApiRef = useRef<NewTaskSurfaceApi | null>(null);
  const openNewTask = useCallback(() => newTaskApiRef.current?.openDialog(), []);
  // 从 GitHub issue 建任务入口（#446 / ADR 0005 读向）：三重门 = live +
  // github 形态 + 已连接。未连接 = 入口不渲染且页面不报错不空白（connection
  // 查询失败面容忍，票面验收）；local/hosted/fixture 面零漂移。查询 enabled
  // 收窄到 github 形态项目（页面挂载不空转，useGithubConnection 同律）。
  const isGithubRepoEntry = live && wireProject?.repoKind === 'github';
  // github 项目 Files tab 诚实降级（#704 / B-C1）：pacman 不保存该形态的仓库
  // 文件副本（Multica link-back 只读方向——关联不镜像），文件面 = 说明 + 外链
  // GitHub；变更与 PR 面走 daemon 上报真值（任务详情 changes / 分支 PR 面板）。
  // 判据复用 issues 入口同源位（live && repoKind === 'github'）。
  const githubFilesUrl =
    isGithubRepoEntry && wireProject?.githubRepo != null
      ? `https://github.com/${wireProject.githubRepo}`
      : null;
  const ghConnQ = useGithubConnection(isGithubRepoEntry ? teamId : undefined, isGithubRepoEntry);
  const ghIssuesAvailable = isGithubRepoEntry && ghConnQ.data?.connected === true;
  const [issuesOpen, setIssuesOpen] = useState(false);
  const closeIssues = useCallback(() => setIssuesOpen(false), []);
  const onIssueImported = useCallback(
    (record: { id: string }) => {
      setIssuesOpen(false);
      // 真用户路径落点：导入即导航任务详情（标题与全部标签当场可见）。
      navigate({ pathname: `/app/todo/${record.id}`, search });
    },
    [navigate, search],
  );
  return (
    <PageShell
      fixture={
        live ? { ...fixture, todos } : { ...fixture, todos: [...fixture.todos, ...fixtureAdded] }
      }
      selected="none"
      leftTitle={project?.name ?? ''}
      // #389: C 热键/侧栏行走本页 dialog（保存锚路由项目，#305 律）
      onNewTask={openNewTask}
      tabs={[
        { id: 'tasks', label: '任务' },
        { id: 'files', label: '文件' },
      ]}
      tab={tab}
      onTab={(next) => setTab(next === 'tasks' ? 'tasks' : 'files')}
    >
      {tab === 'files' && isLocalRepo && treeQ.isError ? (
        // local 仓不可达降级（#1030）：tree 读失败 = server 看不到 localPath
        // （多机部署不同机 / 目录已删 / 已非 git 仓）。不渲染 FilesPane——
        // 空树会被误读成「仓库是空的」，历史面同闸也不再发。分类 reason 走
        // #386 单源分译；未分类失败（网络/5xx）只出主行。
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 text-[13px] text-(--text-tertiary)">
          <span>{t('本地仓库当前无法读取。')}</span>
          {treeQ.error instanceof ApiError &&
          treeQ.error.reason !== undefined &&
          treeQ.error.reason in LOCAL_ERROR_REASON_COPY ? (
            <span className="text-xs">
              {t(LOCAL_ERROR_REASON_COPY[treeQ.error.reason as LocalErrorReason])}
            </span>
          ) : null}
        </div>
      ) : tab === 'files' && isGithubRepoEntry ? (
        <div className="flex min-h-0 flex-1 items-center justify-center gap-3 text-[13px] text-(--text-tertiary)">
          <span>{t('GitHub 仓库项目的文件在 GitHub 上查看')}</span>
          {githubFilesUrl != null && (
            /* #946 better-colors 实测换槽：原规则引 --accent（软分隔线族，
               on surface ≈1.1:1 不可读）——「链接用主题色」的设计意图落品牌槽
               --card-button（#908 裁决 2：配对未过可换消费面槽引用，token
               值不动；实测数字在 PR body）。 */
            <a
              className="text-(--card-button) underline"
              href={githubFilesUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('打开 GitHub 仓库')}
            </a>
          )}
        </div>
      ) : tab === 'files' ? (
        <div className="prj-files flex min-h-0 flex-1">
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
            <div className="block min-w-0 flex-1 overflow-auto px-4 py-3 text-[13px] text-(--text-tertiary)">
              <pre className="m-0 font-mono text-xs leading-[18px] whitespace-pre text-(--foreground)">
                {fileView.content}
              </pre>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-(--text-tertiary)">
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
        <TasksPane
          todos={todos}
          now={live ? Date.now() : fixture.now}
          onNewTask={openNewTask}
          {...(ghIssuesAvailable ? { onOpenGithubIssues: () => setIssuesOpen(true) } : {})}
        />
      )}
      {/* dialog 接线 = NewTaskSurfaceRoot 隔离根，本页差异参数位随 opts 传入。 */}
      <NewTaskSurfaceRoot
        fixture={fixture}
        opts={{ onFixtureSave, anchorProjectId: id, mentions: false, eager: true }}
        apiRef={newTaskApiRef}
      />
      {/* #446 issue 选择弹层：门与入口同闸（ghIssuesAvailable），关着不发
          请求（useGithubIssues enabled 位）。 */}
      {ghIssuesAvailable && id !== undefined && (
        <GithubIssuesDialog
          open={issuesOpen}
          onClose={closeIssues}
          projectId={id}
          teamId={teamId}
          onImported={onIssueImported}
        />
      )}
    </PageShell>
  );
}
