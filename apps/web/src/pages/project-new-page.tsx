// New-project route (issue #71, r2 07): centered 768 column — avatar
// placeholder tile + caption, 项目名称 input, 仓库 selector row, full-width
// 创建项目 primary (disabled until the form is filled, r2 07 muted indigo).
// #83 (M5) live：名称受控 + 创建 = POST /api/projects（repoKind hosted，
// 02 §3 托管 bare 落地）→ 跳项目页。
// #305: the 仓库 selector joins the living controls — anchored popover
// (family law #67/#127: OverlayMount + ClickCatcher + Escape,
// TasksMenuButton/#176 chip-popover precedents) whose rows are the two
// repo forms the create endpoint accepts (02 §3): 新的 Todos 托管仓库
// (hosted — also the effective default an untouched form submits, r2 07c
// canon wording) and GitHub 仓库. Selection is pure form state
// (both faces — fixture has no submit path either way); the live submit
// carries it: hosted → repoKind hosted, github → repoKind github +
// githubRepo, gated client-side by the shared isGithubRepoRef (server's
// 400 gate and this form eat the same single source).
// #361 (spec 12 G2-T4)：GitHub 仓库 选态成为认证门控的 picker 面，三面：
// - 未认证 = 「认证 GitHub」钮（live = POST github/oauth/authorize → 同页签
//   跳走，#231 同律；fixture = accept 律本地翻转）+「手动输入 owner/repo」
//   兜底链接（公开仓免认证 / OAuth 未配置两降级入口）；
// - 已认证 = picker 触发钮（选中 full_name 回填走 hosted 同款 trigger-label
//   律）+ 锚定 picker 弹层（搜索 / 仓库行 / 断开钮 / 手动兜底 = 组织仓不在
//   列表降级入口，#67/#127 家族律）；live 首取在途 = 禁用占位触发行（不闪
//   认证钮误导致点击）；
// - 手动兜底 = 现状 owner/repo input 原样（isGithubRepoRef 提交闸不动）。
// 着陆参 ?oauth=connected|error&reason=…&github=connection（callback 302
// 回本页，server 按 state kind 分支落点）：connected → 复位 github 选态 +
// picker 自动开（同页签跳走期间表单态已丢，选态从着陆参重建）；error →
// reason 三译（#243 词汇不变）落内联错误行。读后清参，刷新不重放。
// 回填律（G2-T3 一致）：项目名仅当空或仍等于上次回填值时覆盖，手改不动。

import { type GithubRepoSummary, isGithubRepoRef } from '@pacman/shared';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApiMutations, useGithubConnection, useGithubRepos } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { oauthReasonCopy } from '../i18n/oauth-reason.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronRight, ImageFrame } from '../icons/index.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from '../overlays/dismiss.js';
import { PageShell } from './shell.js';
import './pages.css';

/** repo 选择态：none = 未动（触发行持「选择仓库」占位；提交实效 = hosted，
 *  即 M5 既有行为）；hosted / github = 用户已选的形态。 */
type RepoSel = 'none' | 'hosted' | 'github';

/** 重开仓库种类菜单的 swap 钮（github 三面共用，#305 原形不动）。 */
function RepoSwapButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="prj-new-repo-swap" aria-label={label} onClick={onClick}>
      <ChevronRight width={14} height={14} />
    </button>
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
  const [repoOpen, setRepoOpen] = useState(false);
  // #361 github 面状态位：manualRepo = 手动兜底 input 面；pickerOpen =
  // picker 弹层；oauthError = 着陆 reason 三译 / authorize 失败原文（内联行）。
  const [manualRepo, setManualRepo] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [repoQuery, setRepoQuery] = useState('');
  // 回填律位：上次 picker 回填的项目名（名称仍等于它 = 用户没手改过，
  // 跟随再选；否则不动）。
  const [lastNameFill, setLastNameFill] = useState<string | null>(null);
  // fixture accept 律本地覆盖（null = 无覆盖，跟 scenario fixture；live 面
  // 不用——连接态 = status 读面真值）。
  const [fixtureAuth, setFixtureAuth] = useState<boolean | null>(null);

  const closeRepo = useCallback(() => setRepoOpen(false), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);
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

  // picker 单选：回填 owner/repo（trigger 面显示）+ 项目名（回填律）+ 收面板。
  const pickRepo = (repo: GithubRepoSummary) => {
    setGithubRepo(repo.full_name);
    if (name === '' || name === lastNameFill) setName(repo.name);
    setLastNameFill(repo.name);
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
      mutations.disconnectGithub.mutate(); // invalidate → status 读面收敛回未认证面
    } else {
      setFixtureAuth(false);
    }
  };

  // github 选态的提交闸：owner/repo 过 server 同源校验（isGithubRepoRef，
  // shared 单源）才放开创建钮——无效值不发请求，server 400 兜底不变。
  // picker 选中回填的 full_name 天然过闸（#361 不动此律）。
  const repoOk = repoSel !== 'github' || isGithubRepoRef(githubRepo.trim());
  const showGithubField = githubSelected && !manualRepo;
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
        <input
          id="prj-new-name"
          className="prj-new-input"
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
                <input
                  id="prj-new-repo"
                  className="prj-new-input prj-new-repo-input"
                  type="text"
                  placeholder="owner/repo"
                  aria-label={t('GitHub 仓库')}
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                />
                <RepoSwapButton label={t('选择仓库')} onClick={() => setRepoOpen(true)} />
              </>
            ) : connectionPending ? (
              <>
                {/* live 首取在途：禁用占位（连接态未决，不闪认证钮）。 */}
                <button type="button" id="prj-new-repo" className="prj-new-repo" disabled>
                  <span className="prj-new-repo-placeholder">{t('选择仓库')}</span>
                </button>
                <RepoSwapButton label={t('选择仓库')} onClick={() => setRepoOpen(true)} />
              </>
            ) : connected ? (
              <>
                <button
                  type="button"
                  id="prj-new-repo"
                  className="prj-new-repo"
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
                </button>
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
                <button
                  type="button"
                  id="prj-new-repo"
                  className="prj-new-gh-auth"
                  onClick={startAuth}
                >
                  {t('认证 GitHub')}
                </button>
                <RepoSwapButton label={t('选择仓库')} onClick={() => setRepoOpen(true)} />
              </>
            )
          ) : (
            <button
              type="button"
              id="prj-new-repo"
              className="prj-new-repo"
              aria-haspopup="listbox"
              aria-expanded={repoOpen}
              onClick={() => setRepoOpen((value) => !value)}
            >
              <span
                className={
                  repoSel === 'hosted' ? 'prj-new-repo-selected' : 'prj-new-repo-placeholder'
                }
              >
                {repoSel === 'hosted' ? t('新的 Todos 托管仓库') : t('选择仓库')}
              </span>
              <ChevronRight width={14} height={14} />
            </button>
          )}
          <OverlayMount open={repoOpen}>
            <ClickCatcher onClose={closeRepo} />
            {/* 行选中态镜像用户动作（aria-selected ≡ check 渲染）：未动 = 无行
                选中（触发行仍持占位文案）；「未动表提交实效 = hosted」是 body
                层行为，不进选择面状态。 */}
            <div className="prj-new-repo-menu anim-pop" role="listbox" aria-label={t('仓库')}>
              <button
                type="button"
                className="prj-new-repo-menu-row"
                role="option"
                aria-selected={repoSel === 'hosted'}
                onClick={() => {
                  setRepoSel('hosted');
                  closeRepo();
                }}
              >
                {t('新的 Todos 托管仓库')}
                {repoSel === 'hosted' && (
                  <span className="prj-new-repo-menu-check">
                    <Check width={14} height={14} />
                  </span>
                )}
              </button>
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
                <button type="button" className="prj-new-gh-disconnect" onClick={disconnect}>
                  {t('断开连接')}
                </button>
              </div>
              <input
                className="prj-new-gh-search"
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
              <button
                type="button"
                className="prj-new-gh-link"
                onClick={() => {
                  setPickerOpen(false);
                  setManualRepo(true);
                }}
              >
                {t('手动输入 owner/repo')}
              </button>
            </div>
          </OverlayMount>
        </div>
        {/* github 非手动面的内联错误行（着陆 reason 三译 / authorize 400
            原文）与未认证面手动兜底链接（连接态未决时不出，随占位面收敛）。 */}
        {showGithubField && oauthError !== null && (
          <div className="prj-new-gh-error" role="alert">
            {oauthError}
          </div>
        )}
        {showGithubField && !connected && !connectionPending && (
          <button type="button" className="prj-new-gh-link" onClick={() => setManualRepo(true)}>
            {t('手动输入 owner/repo')}
          </button>
        )}
        <button
          type="button"
          className="prj-new-submit"
          disabled={live ? name.trim() === '' || !repoOk : true}
          onClick={
            live
              ? () =>
                  mutations.createProject.mutate(
                    repoSel === 'github'
                      ? { name: name.trim(), repoKind: 'github', githubRepo: githubRepo.trim() }
                      : { name: name.trim(), repoKind: 'hosted' },
                    { onSuccess: (p) => navigate(`/app/project/${p.id}`) },
                  )
              : undefined
          }
        >
          {t('创建项目')}
        </button>
      </div>
    </PageShell>
  );
}
