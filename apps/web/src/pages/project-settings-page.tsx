// Project settings route (issue #71, r2 24c): 基本信息|仓库|标签 tab group
// and one card — avatar circle + 更换 link, then 名称/仓库/目标分支/描述 rows.
// #177 (local-first 裁决, endpoint 实测): no project mutation endpoint exists
// anywhere in the stack — no PATCH, no DELETE /api/projects/:id, and the
// schema has no defaultBranch column — so the route's three dead buttons
// resolve wontfix: 更换 stays capture-verbatim chrome (#148 account-swap
// precedent), 目标分支 becomes a static chip (#149 branch-chip precedent),
// and the danger card is removed outright (#148 退出登录 box / #149 导出
// precedent; the ticket premise that DELETE exists did not survive a grep).
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useProjects } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { PROJECT_INITIAL } from '../fixtures/fixtures.js';
import type { ProjectContent } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown, SquarePen } from '../icons/index.js';
import { PageShell, TabGroup } from './shell.js';
import './pages.css';

const TABS = [
  { id: 'basic', label: '基本信息' },
  { id: 'repo', label: '仓库' },
  { id: 'tags', label: '标签' },
];

export function ProjectSettingsPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const [tab, setTab] = useState('basic');
  // M5 live：设置行 = GET /api/projects 检索真值（名称/仓库/托管 chip）。
  const { live, teamId } = useLiveData();
  const projectsQ = useProjects(teamId, live);
  const wireProject = live ? (projectsQ.data ?? []).find((p) => p.id === id) : undefined;
  const project: ProjectContent | undefined = live
    ? wireProject
      ? {
          name: wireProject.name,
          branch: 'main',
          files: [],
          repoName: wireProject.repoName ?? wireProject.githubRepo ?? '',
          hosted: wireProject.repoKind === 'hosted',
          defaultBranch: 'main',
          description: null,
        }
      : undefined
    : fixture.project;
  return (
    <PageShell fixture={fixture} selected="project" title="设置">
      <div className="page-col page-col--settings prj-set-body">
        {/* r2 24c: the tab group sits in the content column, not the topbar */}
        <div className="prj-set-tabs">
          <TabGroup tabs={TABS} tab={tab} onTab={setTab} />
        </div>
        <div className="prj-set-card">
          <div className="prj-set-head">
            <span className="prj-set-avatar">{PROJECT_INITIAL}</span>
            {/* wontfix (#177, #148 account-swap 同律): the avatar is the
                static PROJECT_INITIAL asset — no upload face exists or will;
                the 更换 ink stays as capture-verbatim chrome. */}
            <button type="button" className="prj-set-change">
              {t('更换')}
            </button>
          </div>
          <div className="prj-set-row">
            <span className="prj-set-label">{t('名称')}</span>
            <span className="prj-set-value">
              {project?.name ?? ''}
              <SquarePen width={14} height={14} />
            </span>
          </div>
          <div className="prj-set-row">
            <span className="prj-set-label">{t('仓库')}</span>
            <span className="prj-set-value">
              {project?.repoName ?? ''}
              {project?.hosted === true && <span className="prj-set-chip">{t('Pacman 托管')}</span>}
            </span>
          </div>
          <div className="prj-set-row">
            <span className="prj-set-label">{t('目标分支')}</span>
            <span className="prj-set-value">
              {/* 分支 chip = 静态展示(#177 裁决,#149 分支 chip 同律): schema
                  无 defaultBranch 列、无 PATCH 端点,读面固定 main;chevron 保
                  r2 24c 捕获形状。非交互元素——不再是死钮。 */}
              <span className="prj-set-branch">
                {project?.defaultBranch ?? 'main'}
                <ChevronDown width={12} height={12} />
              </span>
            </span>
          </div>
          <div className="prj-set-row">
            <span className="prj-set-label">{t('描述')}</span>
            <span className="prj-set-value prj-set-value--dim">
              {project?.description ?? t('尚无描述')}
              <SquarePen width={14} height={14} />
            </span>
          </div>
        </div>
        {/* 危险操作区整除(#177 wontfix): 全栈无 DELETE /api/projects/:id
            ——票面前提「端点在」实测不在;#148 退出登录 box、#149 导出钮
            同律全除,en.ts 三键随除。删项目端点落地后由新票复活此区。 */}
      </div>
    </PageShell>
  );
}
