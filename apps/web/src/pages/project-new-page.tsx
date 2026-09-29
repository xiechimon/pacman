// New-project route (issue #71, r2 07): centered 768 column — avatar
// placeholder tile + caption, 项目名称 input, 仓库 selector row, full-width
// 创建项目 primary (disabled until the form is filled, r2 07 muted indigo).
// #83 (M5) live：名称受控 + 创建 = POST /api/projects → 跳项目页。
// #360 (spec 12)：仓库 selector 两行——「GitHub 仓库」（触发行换 owner/repo
// 输入，手动面；OAuth picker 归 G2-T4）与「本地文件夹」（触发行换绝对路径
// 输入，server validateLocalRepoPath 三态校验，400 reason 分类落红色错误
// 行）。hosted 行创建入口移除：未动表单提交 = 无 repo 普通项目（kind 缺省，
// server REST / MCP 仍接受 hosted，存量项目不动）。名称回填：local =
// basename(localPath)，github = repo 段；仅当名称为空或仍等于上次回填值时
// 覆盖（用户手改过则不动）。弹层家族法 #67/#127：OverlayMount +
// ClickCatcher + Escape（TasksMenuButton/#176 chip-popover 先例）。提交
// body 单源 = shared createProjectBodySchema（kind 契约名；github 提交闸
// 与 server 400 门同吃 isGithubRepoRef）。

import { type CreateProjectBody, isGithubRepoRef } from '@pacman/shared';
import { useCallback, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../api/client.js';
import { useApiMutations } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronRight, ImageFrame } from '../icons/index.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from '../overlays/dismiss.js';
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
  const [localPath, setLocalPath] = useState('');
  const [repoOpen, setRepoOpen] = useState(false);
  // 上次自动回填值——名称覆盖判定「为空或仍等于上次回填值」的后半（spec
  // 12）；用户手改（≠ 上次回填且非空）后路径/repo 变化不再覆盖。ref 即可：
  // 只参与事件时判定，不进渲染面。
  const autoName = useRef('');
  const closeRepo = useCallback(() => setRepoOpen(false), []);
  useEscapeClose(repoOpen, closeRepo);

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
    backfillName(pathBasename(value));
  };

  // 提交闸：github = owner/repo 过 server 同源校验（isGithubRepoRef，shared
  // 单源）；local = 路径非空（三态真伪只有 server fs 能判，400 走错误行）；
  // none = 无 repo 项目仅需名称。无效值不发请求，server 400 兜底不变。
  const formOk =
    repoSel === 'github'
      ? isGithubRepoRef(githubRepo.trim())
      : repoSel === 'local'
        ? localPath.trim() !== ''
        : true;

  // local 400 错误行：仅当「本次提交的路径仍是输入框现值」时呈现——编辑
  // 路径即撤（陈旧错误不残留）。reason 分类 = server validateLocalRepoPath
  // 三态消息（services/git.ts）的子串字符串契约，非共享常量：server 改文案
  // 即退化为原文直透（create-provider-dialog connectError 同款约定），漂移
  // 由 drive-project-new-form probe 红牌当场逮住。未分类 reason 同样直透。
  const [submittedPath, setSubmittedPath] = useState<string | null>(null);
  const createError = mutations.createProject.error;
  const localErrorCopy = (message: string): string => {
    if (message.includes('path not found')) return t('路径不存在');
    if (message.includes('not a git repository')) return t('不是 git 仓库');
    if (message.includes('expected absolute path')) return t('需要绝对路径');
    return message;
  };
  const localErrorText =
    repoSel === 'local' &&
    submittedPath !== null &&
    submittedPath === localPath.trim() &&
    createError instanceof ApiError &&
    createError.status === 400
      ? localErrorCopy(createError.message)
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
            <>
              <input
                id="prj-new-repo"
                className="prj-new-input prj-new-repo-input"
                type="text"
                placeholder="owner/repo"
                aria-label={t('GitHub 仓库')}
                value={githubRepo}
                onChange={(e) => onGithubRepoChange(e.target.value)}
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
          ) : repoSel === 'local' ? (
            <>
              <input
                id="prj-new-repo"
                className="prj-new-input prj-new-repo-input"
                type="text"
                placeholder="/path/to/repo"
                aria-label={t('本地文件夹')}
                value={localPath}
                onChange={(e) => onLocalPathChange(e.target.value)}
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
              <span className="prj-new-repo-placeholder">{t('选择仓库')}</span>
              <ChevronRight width={14} height={14} />
            </button>
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
        </div>
        {localErrorText !== null && (
          <div className="prj-new-error" role="alert">
            {localErrorText}
          </div>
        )}
        <button
          type="button"
          className="prj-new-submit"
          disabled={live ? name.trim() === '' || !formOk : true}
          onClick={live ? submit : undefined}
        >
          {t('创建项目')}
        </button>
      </div>
    </PageShell>
  );
}
