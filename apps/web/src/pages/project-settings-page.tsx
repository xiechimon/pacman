// Project settings route (issue #71, r2 24c): 基本信息|仓库|标签 tab group
// and one card — avatar circle + 更换 link, then 名称/仓库/目标分支/描述 rows.
// #177 (local-first 裁决, endpoint 实测): no project mutation endpoint exists
// anywhere in the stack — no PATCH, no DELETE /api/projects/:id, and the
// schema has no defaultBranch column — so the route's three dead buttons
// resolve wontfix: 更换 removed outright (#307, spec 08 档 4 — the avatar
// is the static PROJECT_INITIAL asset, no upload face; this item's
// #148/#177 capture-verbatim-chrome verdict re-adjudicated 移除, the
// account-swap twin stays with 档 3), 目标分支
// becomes a static chip (#149 branch-chip precedent),
// and the danger card is removed outright (#148 退出登录 box / #149 导出
// precedent; the ticket premise that DELETE exists did not survive a grep).
// #207 复活危险区: #189 DELETE /api/projects/:id 落地(级联单源 server
// services/projects.ts),删除卡归位 + DeleteConfirm 家族确认弹层(r2 24d,
// 键入项目名闸门) + deleteProject mutation(invalidateAll 正典);确认后跳
// /app(fixture 走 #66 deletions 覆面,侧栏项目行随行隐去)。
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useApiMutations, useProjects } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { markDeleted } from '../fixtures/deletions.js';
import { PROJECT_INITIAL } from '../fixtures/fixtures.js';
import type { ProjectContent } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown, SquarePen } from '../icons/index.js';
import { DeleteProjectConfirm } from '../overlay/delete-project-confirm.js';
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const [tab, setTab] = useState('basic');
  const [deleteOpen, setDeleteOpen] = useState(false);
  // M5 live：设置行 = GET /api/projects 检索真值（名称/仓库/托管 chip）。
  const { live, teamId } = useLiveData();
  const projectsQ = useProjects(teamId, live);
  const mutations = useApiMutations(teamId);
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
            {/* 「更换」钮全除（#307 wontfix）：头像是静态 PROJECT_INITIAL 资产,
                栈内无上传面——档 4 二分律下本项 #177 占位 chrome 裁决改判
                移除（account-swap 同款归档 3，本票不动）。 */}
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
        {/* 危险操作区(#207 复活): #189 DELETE /api/projects/:id 已落地,
            卡面 = #177 整除前形状原样归位(r2 24c),钮接真确认流。 */}
        <div className="prj-set-danger-label">{t('危险操作')}</div>
        <div className="prj-set-card prj-set-card--danger">
          <div className="prj-set-danger-title">{t('删除项目')}</div>
          <div className="prj-set-danger-desc">
            {t('将永久删除所有任务与执行记录，此操作不可恢复。')}
          </div>
          <button type="button" className="prj-set-delete" onClick={() => setDeleteOpen(true)}>
            {t('删除')}
          </button>
        </div>
      </div>
      {/* 确认弹层(r2 24d, DeleteConfirm 家族): 键入项目名精确匹配才解禁;
          确认后跳项目列表面 —— live 走 DELETE + invalidateAll 重取,fixture
          走 #66 deletions 覆面(侧栏项目行随行隐去,reload 还原)。 */}
      <DeleteProjectConfirm
        projectName={project?.name ?? ''}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          if (live) {
            if (id !== undefined) {
              mutations.deleteProject.mutate(id, { onSuccess: () => navigate('/app') });
            }
            return;
          }
          if (id !== undefined) markDeleted(id);
          navigate('/app');
        }}
      />
    </PageShell>
  );
}
