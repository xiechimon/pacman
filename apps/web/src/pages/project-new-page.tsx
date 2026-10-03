// New-project route (issue #71, r2 07): centered 768 column — avatar
// placeholder tile + caption, 项目名称 input, 仓库 selector row, full-width
// 创建项目 primary (disabled until the form is filled, r2 07 muted indigo).
// #83 (M5) live：名称受控 + 创建 = POST /api/projects → 跳项目页。
// #360 (spec 12 G2-T3)：仓库 selector 两行——「GitHub 仓库」（认证门控
// picker 面见下方 #361 段）与「本地文件夹」（触发行换绝对路径输入，server
// validateLocalRepoPath 三态校验，400 reason code 分类落红色错误行）。hosted 行
// 创建入口移除：未动表单提交 = 无 repo 普通项目（kind 缺省，server REST /
// MCP 仍接受 hosted，存量项目不动）。名称回填：local = basename(localPath)，
// github = repo 段；仅当名称为空或仍等于上次回填值时覆盖（用户手改过则
// 不动）。弹层家族法 #67/#127：OverlayMount + ClickCatcher + Escape
// （TasksMenuButton/#176 chip-popover 先例）。提交 body 单源 = shared
// createProjectBodySchema（kind 契约名；github 提交闸与 server 400 门同吃
// isGithubRepoRef）。
// #361 (spec 12 G2-T4)：GitHub 仓库 选态成为认证门控的 picker 面，三面：
// - 未认证 = 「认证 GitHub」钮（live = POST github/oauth/authorize → 同页签
//   跳走，#231 同律；fixture = accept 律本地翻转）+「手动输入 owner/repo」
//   兜底链接（公开仓免认证 / OAuth 未配置两降级入口）；
// - 已认证 = picker 触发钮（选中 full_name 回填走 trigger-label 律）+ 锚定
//   picker 弹层（搜索 / 仓库行 / 断开钮 / 手动兜底 = 组织仓不在列表降级
//   入口，#67/#127 家族律）；live 首取在途 = 禁用占位触发行（不闪认证钮
//   误导致点击）；
// - 手动兜底 = owner/repo input（isGithubRepoRef 提交闸 + repo 段名称回填
//   律不动）。
// 着陆参 ?oauth=connected|error&reason=…&github=connection（callback 302
// 回本页，server 按 state kind 分支落点）：connected → 复位 github 选态 +
// picker 自动开（同页签跳走期间表单态已丢，选态从着陆参重建）；error →
// reason 三译（#243 词汇不变）落内联错误行。读后清参，刷新不重放。

import {
  type CreateProjectBody,
  FS_PICK_ERROR_COPY,
  type FsPickErrorReason,
  type GithubRepoSummary,
  isGithubRepoRef,
  LOCAL_ERROR_REASON_COPY,
  type LocalErrorReason,
} from '@pacman/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../api/client.js';
import { useApiMutations, useGithubConnection, useGithubRepos } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { toastError } from '../components/ui/toaster.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { oauthReasonCopy } from '../i18n/oauth-reason.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronRight, ImageFrame } from '../icons/index.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from '../overlays/dismiss.js';
import { DirBrowser } from './dir-browser.js';
import { PageShell } from './shell.js';
import './pages.css';

/** repo 选择态：none = 未动（触发行持「选择仓库」占位；提交实效 = 无 repo
 *  普通项目，spec 12）；github / local = 用户已选的形态。 */
type RepoSel = 'none' | 'github' | 'local';

/** 本地路径末段（名称回填源）：容忍尾部斜杠；根路径与 `.`/`..` 无段可回
 *  = 返回空串跳过回填。`~` 前缀原样参与取段（server 侧展开，两侧同值）。 */
function pathBasename(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (trimmed === '') return '';
  const segment = trimmed.slice(trimmed.lastIndexOf('/') + 1);
  return segment === '.' || segment === '..' ? '' : segment;
}

/** 重开仓库种类菜单的 swap 钮（github 三面共用，#305 原形不动）。
 *  XMON-25 收编：ghost + size icon；40×40 几何/边框/墨色正本在 per-face；
 *  size-auto 保 ChevronRight 的 14px 属性尺寸（base 会强制 16）。 */
function RepoSwapButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="prj-new-repo-swap font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
      aria-label={label}
      onClick={onClick}
    >
      <ChevronRight width={14} height={14} />
    </Button>
  );
}

export function ProjectNewPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const { live, teamId } = useLiveData();
  const navigate = useNavigate();
  const mutations = useApiMutations(teamId);
  const [name, setName] = useState('');
  const [repoSel, setRepoSel] = useState<RepoSel>('none');
  const [githubRepo, setGithubRepo] = useState('');
  const [localPath, setLocalPath] = useState('');
  // #440：浏览钮在飞位（disabled + server 单飞双保险）与降级提示行文案
  // （ADR 0003 D4——能力边界说明，非错误级；null = 无提示）。
  const [pickBusy, setPickBusy] = useState(false);
  const [pickHint, setPickHint] = useState<string | null>(null);
  // #441：native 对话框不可用（422 unavailable，remote/headless 形态）时自动
  // 打开应用内目录浏览器兜底（ADR 0003 D6）；其余错误只落提示行不开 overlay。
  const [browseOpen, setBrowseOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  // #361 github 面状态位：manualRepo = 手动兜底 input 面；pickerOpen =
  // picker 弹层；oauthError = 着陆 reason 三译 / authorize 失败原文（内联行）。
  const [manualRepo, setManualRepo] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [repoQuery, setRepoQuery] = useState('');
  // fixture accept 律本地覆盖（null = 无覆盖，跟 scenario fixture；live 面
  // 不用——连接态 = status 读面真值）。
  const [fixtureAuth, setFixtureAuth] = useState<boolean | null>(null);
  // 上次自动回填值——名称覆盖判定「为空或仍等于上次回填值」的后半（spec
  // 12）；用户手改（≠ 上次回填且非空）后路径/repo 变化不再覆盖。ref 即可：
  // 只参与事件时判定，不进渲染面。
  const autoName = useRef('');
  const closeRepo = useCallback(() => setRepoOpen(false), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const closeBrowse = useCallback(() => setBrowseOpen(false), []);
  useEscapeClose(repoOpen, closeRepo);
  useEscapeClose(pickerOpen, closePicker);

  // OAuth callback 着陆参（?oauth=…&github=connection——connection 族专属
  // 旗标，provider 族着陆不带、providers-page 消费面互不串）。只删
  // oauth/reason/github 三键——scenario 等其余参保留（providers-page 同律）。
  useEffect(() => {
    const oauth = searchParams.get('oauth');
    if (oauth === null || searchParams.get('github') !== 'connection') return;
    setRepoSel('github');
    setManualRepo(false);
    if (oauth === 'connected') {
      setOauthError(null);
      setPickerOpen(true);
    } else {
      // #243 reason 三路分译单源 = i18n/oauth-reason.ts（providers-page 共用）。
      setOauthError(oauthReasonCopy(searchParams.get('reason'), t));
    }
    const next = new URLSearchParams(searchParams);
    next.delete('oauth');
    next.delete('reason');
    next.delete('github');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, t]);

  const githubSelected = repoSel === 'github';
  // 连接态：live = GET connection 封套（github 选态才拉，页面挂载不空转）；
  // fixture = scenario 数据 + accept 律本地覆盖。live 首取在途 = 未决态
  // （禁用占位触发行，不闪认证钮误导点击；refetch 期 data 在场不回落）。
  const connectionQ = useGithubConnection(teamId, live && githubSelected);
  const connectionPending = live && githubSelected && connectionQ.isPending;
  const connected = live
    ? (connectionQ.data?.connected ?? false)
    : (fixtureAuth ?? fixture.github?.connected === true);
  const login = live ? connectionQ.data?.login : fixture.github?.login;
  // picker 仓库行：live 于已认证 picker 面在途才拉；搜索过滤本地做
  // （单页 100 条一次取回，server q 为同值兜底；>100 仓的列表外命中走
  // 手动兜底——分页归后续需要时再开，T1 代理面同律）。
  const reposQ = useGithubRepos(live && githubSelected && connected && !manualRepo);
  const repos = live ? (reposQ.data?.repos ?? []) : (fixture.github?.repos ?? []);
  const query = repoQuery.trim().toLowerCase();
  const hits =
    query === '' ? repos : repos.filter((r) => r.full_name.toLowerCase().includes(query));

  // 上次自动回填值——名称覆盖判定「为空或仍等于上次回填值时覆盖」的后半
  // （spec 12）；用户手改（≠ 上次回填且非空）后路径/repo 变化不再覆盖。
  const backfillName = (next: string) => {
    if (next === '') return;
    if (name !== '' && name !== autoName.current) return;
    setName(next);
    autoName.current = next;
  };
  const onGithubRepoChange = (value: string) => {
    setGithubRepo(value);
    const ref = value.trim();
    // 有效 owner/repo 才回填 repo 段；半截输入（无斜杠/非法字符）不动名称。
    if (isGithubRepoRef(ref)) backfillName(ref.slice(ref.indexOf('/') + 1));
  };
  const onLocalPathChange = (value: string) => {
    setLocalPath(value);
    // 编辑即撤提示（陈旧提示不残留，localErrorText 同律）。
    setPickHint(null);
    backfillName(pathBasename(value));
  };

  // #440 浏览钮（ADR 0003 D1/D4）：server 代弹 macOS 原生选文件夹对话框。
  // 取消 = 静默 no-op（{path:null} 是正常结局）；能力缺失/单飞 = reason 分译
  // 落中性提示行；未分类失败原文直透（LOCAL_ERROR_REASON_COPY 降级同律）。
  // 结果直接覆盖 localPath（S11 最后动作赢，#440 失败方式清单）并走既有
  // basename 回填律。
  const browseFolder = () => {
    if (pickBusy) return;
    setPickBusy(true);
    setPickHint(null);
    mutations.pickLocalFolder.mutate(undefined, {
      onSuccess: (data) => {
        if (data.path !== null) onLocalPathChange(data.path);
      },
      onError: (err) => {
        const reason = err instanceof ApiError ? err.reason : undefined;
        setPickHint(
          reason !== undefined && reason in FS_PICK_ERROR_COPY
            ? t(FS_PICK_ERROR_COPY[reason as FsPickErrorReason])
            : err instanceof ApiError
              ? err.message
              : t('无法打开系统文件夹对话框'),
        );
        // #441 兜底：unavailable = remote/headless 形态（无 GUI 会话），自动开
        // 应用内目录浏览器（ADR 0003 D6）；busy（409）与未分类错只落提示行。
        if (reason === 'unavailable') setBrowseOpen(true);
      },
      onSettled: () => setPickBusy(false),
    });
  };

  // picker 单选：回填 owner/repo（trigger 面显示）+ 项目名（回填律）+ 收面板。
  const pickRepo = (repo: GithubRepoSummary) => {
    setGithubRepo(repo.full_name);
    backfillName(repo.name);
    setPickerOpen(false);
    setOauthError(null);
  };

  const startAuth = () => {
    setOauthError(null);
    if (live) {
      mutations.startGithubOAuth.mutate(undefined, {
        // 成功 = 同页签跳授权页；页面随整页导航退场（startProviderOAuth 同律）。
        onSuccess: (data) => window.location.assign(data.authorizationUrl),
        onError: (err) => setOauthError(err.message),
      });
    } else {
      setFixtureAuth(true); // fixture accept 律：点认证 = 认证通过
    }
  };

  const disconnect = () => {
    setPickerOpen(false);
    if (live) {
      // invalidate → status 读面收敛回未认证面；#638 失败 = 连接还挂着却零解释。
      mutations.disconnectGithub.mutate(undefined, {
        onError: (error) => toastError(t('断开连接失败，请重试。'), error),
      });
    } else {
      setFixtureAuth(false);
    }
  };

  // 提交闸：github = owner/repo 过 server 同源校验（isGithubRepoRef，shared
  // 单源——picker 选中回填的 full_name 天然过闸，#361 不动此律）；local =
  // 路径非空（三态真伪只有 server fs 能判，400 走错误行）；none = 无 repo
  // 项目仅需名称。无效值不发请求，server 400 兜底不变。
  const formOk =
    repoSel === 'github'
      ? isGithubRepoRef(githubRepo.trim())
      : repoSel === 'local'
        ? localPath.trim() !== ''
        : true;
  const showGithubField = githubSelected && !manualRepo;

  // local 400 错误行：仅当「本次提交的路径仍是输入框现值」时呈现——编辑
  // 路径即撤（陈旧错误不残留）。reason 分类按 server 应答的结构化 code
  // （#386，词汇单源 = shared PROJECT_LOCAL_ERROR_REASONS），消息子串不再
  // 是契约；无 code 或未分类 reason = 原文直透。
  const [submittedPath, setSubmittedPath] = useState<string | null>(null);
  const createError = mutations.createProject.error;
  const localErrorCopy = (reason: string | undefined, message: string): string =>
    reason !== undefined && reason in LOCAL_ERROR_REASON_COPY
      ? t(LOCAL_ERROR_REASON_COPY[reason as LocalErrorReason])
      : message;
  const localErrorText =
    repoSel === 'local' &&
    submittedPath !== null &&
    submittedPath === localPath.trim() &&
    createError instanceof ApiError &&
    createError.status === 400
      ? localErrorCopy(createError.reason, createError.message)
      : null;

  const submit = () => {
    const body: CreateProjectBody =
      repoSel === 'github'
        ? { name: name.trim(), kind: 'github', githubRepo: githubRepo.trim() }
        : repoSel === 'local'
          ? { name: name.trim(), kind: 'local', localPath: localPath.trim() }
          : { name: name.trim() };
    if (repoSel === 'local') setSubmittedPath(localPath.trim());
    mutations.createProject.mutate(body, {
      onSuccess: (p) => navigate(`/app/project/${p.id}`),
      // #638：local-400 已有内联错误行（localErrorText，编辑即撤）——不双报。
      // 其余失败（github ref 校验 400 / 5xx / 网络）此前无任何反馈位，toast
      // 点名；判据与 localErrorText 的呈现闸同源（本次提交形态 + status）。
      onError: (error) => {
        const inlineHandled =
          repoSel === 'local' && error instanceof ApiError && error.status === 400;
        if (!inlineHandled) toastError(t('创建项目失败，请重试。'), error);
      },
    });
  };

  return (
    <PageShell fixture={fixture} selected="none" title="新建项目">
      <div className="page-col prj-new-body">
        <div className="prj-new-tile">
          <ImageFrame />
        </div>
        <div className="prj-new-caption">{t('可选。未设置时以首字母代替。')}</div>
        <label className="prj-new-label" htmlFor="prj-new-name">
          {t('项目名称')}
        </label>
        {/* XMON-25 收编：Input 原语；本面 h40/内边距/边框/focus 配方（outline
            none + indigo 边 + 1px 影）与 ::placeholder 全在 per-face
            .prj-new-input（unlayered 恒胜）。transition-none = 原裸 input
            无过渡，focus 边框瞬翻（e2e 同步取 computed 钉 indigo，base 的
            transition-colors 会让取数落在渐变中途）。 */}
        <Input
          id="prj-new-name"
          className="prj-new-input leading-[inherit] md:leading-[inherit] transition-none"
          type="text"
          placeholder="My App"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="prj-new-label" htmlFor="prj-new-repo">
          {t('仓库')}
        </label>
        <div className="prj-new-repo-field">
          {repoSel === 'github' ? (
            manualRepo ? (
              <>
                {/* XMON-25 收编：Input；皮肤/几何/focus 正本在 per-face（同
                    名称输入面，transition-none 同理）。 */}
                <Input
                  id="prj-new-repo"
                  className="prj-new-input prj-new-repo-input leading-[inherit] md:leading-[inherit] transition-none"
                  type="text"
                  placeholder="owner/repo"
                  aria-label={t('GitHub 仓库')}
                  value={githubRepo}
                  onChange={(e) => onGithubRepoChange(e.target.value)}
                />
                <RepoSwapButton label={t('选择仓库')} onClick={() => setRepoOpen(true)} />
              </>
            ) : connectionPending ? (
              <>
                {/* live 首取在途：禁用占位（连接态未决，不闪认证钮）。
                    XMON-25 收编：ghost；禁用态原面无降档（per-face 无
                    :disabled 规则）→ opacity-100 + pointer-events-auto 保
                    「禁用仍画 per-face pointer 光标」的现行为。 */}
                <Button
                  variant="ghost"
                  id="prj-new-repo"
                  className="prj-new-repo font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0 disabled:pointer-events-auto disabled:opacity-100"
                  disabled
                >
                  <span className="prj-new-repo-placeholder">{t('选择仓库')}</span>
                </Button>
                <RepoSwapButton label={t('选择仓库')} onClick={() => setRepoOpen(true)} />
              </>
            ) : connected ? (
              <>
                {/* XMON-25 收编：ghost；haspopup 使 base active 位移自动跳过；
                    aria-expanded 底色档被 per-face bg 简写压掉 = 现行为；
                    size-auto 保 ChevronRight 14px。 */}
                <Button
                  variant="ghost"
                  id="prj-new-repo"
                  className="prj-new-repo font-normal leading-[inherit] [&_svg:not([class*='size-'])]:size-auto"
                  aria-haspopup="listbox"
                  aria-expanded={pickerOpen}
                  onClick={() => {
                    setRepoOpen(false);
                    setPickerOpen((value) => !value);
                  }}
                >
                  <span
                    className={
                      githubRepo === '' ? 'prj-new-repo-placeholder' : 'prj-new-repo-selected'
                    }
                  >
                    {githubRepo === '' ? t('选择 GitHub 仓库') : githubRepo}
                  </span>
                  <ChevronRight width={14} height={14} />
                </Button>
                <RepoSwapButton
                  label={t('选择仓库')}
                  onClick={() => {
                    setPickerOpen(false);
                    setRepoOpen(true);
                  }}
                />
              </>
            ) : (
              <>
                {/* XMON-25 收编：brand（--card-button 实底等价迁移位）；
                    h40/flex:1 几何正本在 per-face。 */}
                <Button
                  variant="brand"
                  id="prj-new-repo"
                  className="prj-new-gh-auth font-normal active:not-aria-[haspopup]:translate-y-0"
                  onClick={startAuth}
                >
                  {t('认证 GitHub')}
                </Button>
                <RepoSwapButton label={t('选择仓库')} onClick={() => setRepoOpen(true)} />
              </>
            )
          ) : repoSel === 'local' ? (
            <>
              {/* XMON-25 收编：Input；皮肤/几何/focus 正本在 per-face。 */}
              <Input
                id="prj-new-repo"
                className="prj-new-input prj-new-repo-input leading-[inherit] md:leading-[inherit] transition-none"
                type="text"
                placeholder="/path/to/repo"
                aria-label={t('本地文件夹')}
                value={localPath}
                onChange={(e) => onLocalPathChange(e.target.value)}
              />
              {/* XMON-25 收编：ghost；:disabled .55 + cursor default 正本在
                  per-face（unlayered 恒胜 base 的 opacity-50）。 */}
              <Button
                variant="ghost"
                className="prj-new-browse font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0"
                aria-label={t('浏览')}
                disabled={pickBusy}
                onClick={browseFolder}
              >
                {t('浏览')}
              </Button>
              {/* local 面的种类 swap（RepoSwapButton 同形，#305 内联副本）。 */}
              <Button
                variant="ghost"
                size="icon"
                className="prj-new-repo-swap font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
                aria-label={t('选择仓库')}
                onClick={() => setRepoOpen(true)}
              >
                <ChevronRight width={14} height={14} />
              </Button>
            </>
          ) : (
            // XMON-25 收编：ghost（同已连接 picker 触发面口径）。
            <Button
              variant="ghost"
              id="prj-new-repo"
              className="prj-new-repo font-normal leading-[inherit] [&_svg:not([class*='size-'])]:size-auto"
              aria-haspopup="listbox"
              aria-expanded={repoOpen}
              onClick={() => setRepoOpen((value) => !value)}
            >
              <span className="prj-new-repo-placeholder">{t('选择仓库')}</span>
              <ChevronRight width={14} height={14} />
            </Button>
          )}
          <OverlayMount open={repoOpen}>
            <ClickCatcher onClose={closeRepo} />
            {/* 行选中态镜像用户动作（aria-selected ≡ check 渲染）：未动 =
                无行选中（触发行仍持占位文案；「未动表提交 = 无 repo 项目」
                是 body 层行为，不进选择面状态）。 */}
            <div className="prj-new-repo-menu anim-pop" role="listbox" aria-label={t('仓库')}>
              <button
                type="button"
                className="prj-new-repo-menu-row"
                role="option"
                aria-selected={repoSel === 'github'}
                onClick={() => {
                  setRepoSel('github');
                  setPickerOpen(false);
                  closeRepo();
                }}
              >
                {t('GitHub 仓库')}
                {repoSel === 'github' && (
                  <span className="prj-new-repo-menu-check">
                    <Check width={14} height={14} />
                  </span>
                )}
              </button>
              <button
                type="button"
                className="prj-new-repo-menu-row"
                role="option"
                aria-selected={repoSel === 'local'}
                onClick={() => {
                  setRepoSel('local');
                  closeRepo();
                }}
              >
                {t('本地文件夹')}
                {repoSel === 'local' && (
                  <span className="prj-new-repo-menu-check">
                    <Check width={14} height={14} />
                  </span>
                )}
              </button>
            </div>
          </OverlayMount>
          {/* picker 弹层（#361）：已认证面专属——头部（已连接 login + 断开钮）/
              搜索 / 仓库行（单选即回填收面板，aria-selected ≡ check 律）/
              手动兜底链接。plate = prj-new-repo-menu 同 family recipe。 */}
          <OverlayMount open={showGithubField && connected && pickerOpen}>
            <ClickCatcher onClose={closePicker} />
            <div className="prj-new-gh-picker anim-pop">
              <div className="prj-new-gh-picker-head">
                <span className="prj-new-gh-login">
                  {login === undefined || login === '' ? t('已连接') : `${t('已连接')} · ${login}`}
                </span>
                {/* XMON-25 收编：ghost；per-face 不钉高度/行高 → h-auto +
                    leading-[inherit]：应用内 preflight 对 button 置
                    line-height: inherit，老面继承 picker-head 的 16px；
                    normal/text-sm 都会抬高（像素对拍实测 h 16→17）。 */}
                <Button
                  variant="ghost"
                  className="prj-new-gh-disconnect h-auto rounded-none font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0"
                  onClick={disconnect}
                >
                  {t('断开连接')}
                </Button>
              </div>
              {/* XMON-25 收编：Input；本面 per-face 无 focus 配方 → 现行为 =
                  #388 全局环，原语 outline-none（utilities 层）会压掉 base 层
                  全局环，故补 #388 同配方 outline + ring-0（branch-dialog
                  XMON-24 先例）。h-8/px-2.5 与 per-face 32 高/10 内边距同值；
                  leading-[inherit] 复刻 preflight 对裸 input 的继承行高
                  （19.5px），text-sm 比例行高会把基线抬 ~0.5px。 */}
              <Input
                className="prj-new-gh-search leading-[inherit] md:leading-[inherit] focus-visible:ring-0 focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2"
                type="text"
                placeholder={t('搜索仓库')}
                aria-label={t('搜索仓库')}
                value={repoQuery}
                onChange={(e) => setRepoQuery(e.target.value)}
              />
              {hits.length === 0 ? (
                // live 取回在途不闪空面文案（pending ≠ 无命中）。
                live && reposQ.isPending ? null : (
                  <div className="prj-new-gh-empty">{t('没有匹配的仓库')}</div>
                )
              ) : (
                <div className="prj-new-gh-list" role="listbox" aria-label={t('GitHub 仓库')}>
                  {hits.map((repo) => (
                    <button
                      type="button"
                      key={repo.id}
                      className="prj-new-gh-row"
                      role="option"
                      aria-selected={githubRepo === repo.full_name}
                      onClick={() => pickRepo(repo)}
                    >
                      {repo.full_name}
                      {githubRepo === repo.full_name && (
                        <span className="prj-new-gh-row-check">
                          <Check width={14} height={14} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {live && reposQ.isError ? (
                <div className="prj-new-gh-error" role="alert">
                  {(reposQ.error as Error).message}
                </div>
              ) : null}
              {/* XMON-25 收编：ghost；12/16 字体与下划线正本在 per-face，
                  h-auto 保 16px 内容高。 */}
              <Button
                variant="ghost"
                className="prj-new-gh-link h-auto rounded-none font-normal active:not-aria-[haspopup]:translate-y-0"
                onClick={() => {
                  setPickerOpen(false);
                  setManualRepo(true);
                }}
              >
                {t('手动输入 owner/repo')}
              </Button>
            </div>
          </OverlayMount>
          {/* #441 应用内目录浏览器（ADR 0003 D6 remote/headless 兜底）：仅在
              local 选态挂载；onPick 走既有 onLocalPathChange（回填 + 名称联动
              + 编辑即撤提示律，W5）。 */}
          {repoSel === 'local' && (
            <DirBrowser
              open={browseOpen}
              onClose={closeBrowse}
              onPick={(path) => {
                setBrowseOpen(false);
                onLocalPathChange(path);
              }}
            />
          )}
        </div>
        {/* github 非手动面的内联错误行（着陆 reason 三译 / authorize 400
            原文）与未认证面手动兜底链接（连接态未决时不出，随占位面收敛）。 */}
        {showGithubField && oauthError !== null && (
          <div className="prj-new-gh-error" role="alert">
            {oauthError}
          </div>
        )}
        {showGithubField && !connected && !connectionPending && (
          <Button
            variant="ghost"
            className="prj-new-gh-link h-auto rounded-none font-normal active:not-aria-[haspopup]:translate-y-0"
            onClick={() => setManualRepo(true)}
          >
            {t('手动输入 owner/repo')}
          </Button>
        )}
        {localErrorText !== null && (
          <div className="prj-new-error" role="alert">
            {localErrorText}
          </div>
        )}
        {/* #440 降级提示行（ADR 0003 D4）：能力边界说明非错误级——中性色、
            无 role=alert；仅 local 选态呈现，编辑路径即撤。 */}
        {repoSel === 'local' && pickHint !== null && <div className="prj-new-hint">{pickHint}</div>}
        {/* XMON-25 收编：brand；禁用态正本在 per-face（:disabled .55 +
            cursor default，unlayered 恒胜 brand 的 lavender 实底档）。 */}
        <Button
          variant="brand"
          className="prj-new-submit font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0"
          disabled={live ? name.trim() === '' || !formOk : true}
          onClick={live ? submit : undefined}
        >
          {t('创建项目')}
        </Button>
      </div>
    </PageShell>
  );
}
