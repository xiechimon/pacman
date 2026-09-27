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
// canon wording) and GitHub 仓库 (the trigger row becomes an owner/repo
// input; the swap chevron reopens the menu). Selection is pure form state
// (both faces — fixture has no submit path either way); the live submit
// carries it: hosted → repoKind hosted, github → repoKind github +
// githubRepo, gated client-side by the shared isGithubRepoRef (server's
// 400 gate and this form eat the same single source).

import { isGithubRepoRef } from '@pacman/shared';
import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApiMutations } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronRight, ImageFrame } from '../icons/index.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from '../overlays/dismiss.js';
import { PageShell } from './shell.js';
import './pages.css';

/** repo 选择态：none = 未动（触发行持「选择仓库」占位；提交实效 = hosted，
 *  即 M5 既有行为）；hosted / github = 用户已选的形态。 */
type RepoSel = 'none' | 'hosted' | 'github';

export function ProjectNewPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const { live, teamId } = useLiveData();
  const navigate = useNavigate();
  const mutations = useApiMutations(teamId);
  const [name, setName] = useState('');
  const [repoSel, setRepoSel] = useState<RepoSel>('none');
  const [githubRepo, setGithubRepo] = useState('');
  const [repoOpen, setRepoOpen] = useState(false);
  const closeRepo = useCallback(() => setRepoOpen(false), []);
  useEscapeClose(repoOpen, closeRepo);
  // github 选态的提交闸：owner/repo 过 server 同源校验（isGithubRepoRef，
  // shared 单源）才放开创建钮——无效值不发请求，server 400 兜底不变。
  const repoOk = repoSel !== 'github' || isGithubRepoRef(githubRepo.trim());
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
          {...(live ? { value: name, onChange: (e) => setName(e.target.value) } : {})}
        />
        <label className="prj-new-label" htmlFor="prj-new-repo">
          {t('仓库')}
        </label>
        <div className="prj-new-repo-field">
          {repoSel === 'github' ? (
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
              <button
                type="button"
                className="prj-new-repo-swap"
                aria-label={t('选择仓库')}
                onClick={() => setRepoOpen(true)}
              >
                <ChevronRight width={14} height={14} />
              </button>
            </>
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
        </div>
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
