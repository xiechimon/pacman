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
import { Button } from '../components/ui/button.js';
import { Panel, PanelHead, PanelLabel, PanelRow, PanelValue } from '../components/ui/panel.js';
import { toastError } from '../components/ui/toaster.js';
import { markDeleted } from '../fixtures/deletions.js';
import { PROJECT_INITIAL } from '../fixtures/fixtures.js';
import type { ProjectContent } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown, SquarePen } from '../icons/index.js';
import { DeleteProjectConfirm } from '../overlay/delete-project-confirm.js';
import { PageShell, TabGroup } from './shell.js';

const TABS = [
  { id: 'basic', label: '基本信息' },
  { id: 'repo', label: '仓库' },
  { id: 'tags', label: '标签' },
];

/** 行右值槽（原 .prj-set-value）：8px 间距 + 13/20 字；行内 svg（编辑
 *  铅笔/chevron）tertiary 墨 + pointer（#177 静态化后仅光标语义）。 */
const VALUE_CLS =
  'gap-2 text-[13px] leading-5 [&_svg]:cursor-pointer [&_svg]:text-(--text-tertiary)';

/** 删除钮（原 .prj-set-delete，XMON-25 收编形迁 utility）：destructive
 *  变体（语义位）+ --danger 实底皮肤——件配方的软底档（bg-destructive/10 +
 *  dark:/20）与 hover 提亮按七通道律压回实底恒定值（旧面 per-face 无 hover
 *  规则，实底不随 hover 变）；compact 几何 28/12/13 等值；ring-0 掐掉
 *  destructive 的 focus 附加环（本面 focus = #388 全局环/件基类单源）。 */
const DELETE_BTN_CLS =
  'mt-3 h-7 cursor-pointer rounded-none border-none bg-(--danger) px-3 text-[13px] font-normal leading-[inherit] text-(--text-on-accent) hover:bg-(--danger) dark:bg-(--danger) dark:hover:bg-(--danger) active:not-aria-[haspopup]:translate-y-0 focus-visible:ring-0';

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
    <PageShell fixture={fixture} selected="none" title="设置">
      <div className="mx-auto w-[760px] pt-5">
        {/* r2 24c: the tab group sits in the content column, not the topbar */}
        <div className="flex">
          <TabGroup tabs={TABS} tab={tab} onTab={setTab} />
        </div>
        {/* #946: 皮肤 = Panel quiet 档；per-face 只剩几何 utility（原
            .prj-set-card/-head/-row/-label/-value 等值迁移）。 */}
        <Panel variant="quiet" className="mt-4 overflow-hidden">
          <PanelHead className="py-4">
            <span className="prj-set-avatar flex size-16 items-center justify-center rounded-full bg-(--surface-tertiary) text-xl text-(--text-secondary)">
              {PROJECT_INITIAL}
            </span>
            {/* 「更换」钮全除（#307 wontfix）：头像是静态 PROJECT_INITIAL 资产,
                栈内无上传面——档 4 二分律下本项 #177 占位 chrome 裁决改判
                移除（account-swap 同款归档 3，本票不动）。 */}
          </PanelHead>
          <PanelRow className="min-h-12 px-4 py-1.5">
            <PanelLabel className="leading-5">{t('名称')}</PanelLabel>
            <PanelValue className={VALUE_CLS}>
              {project?.name ?? ''}
              <SquarePen width={14} height={14} />
            </PanelValue>
          </PanelRow>
          <PanelRow className="min-h-12 px-4 py-1.5">
            <PanelLabel className="leading-5">{t('仓库')}</PanelLabel>
            <PanelValue className={VALUE_CLS}>
              {project?.repoName ?? ''}
              {project?.hosted === true && (
                <span className="rounded-[4px] bg-(--surface-tertiary) px-1.5 py-0.5 text-[11px] leading-[14px] text-(--text-tertiary)">
                  {t('Pacman 托管')}
                </span>
              )}
            </PanelValue>
          </PanelRow>
          <PanelRow className="min-h-12 px-4 py-1.5">
            <PanelLabel className="leading-5">{t('目标分支')}</PanelLabel>
            <PanelValue className={VALUE_CLS}>
              {/* 分支 chip = 静态展示(#177 裁决,#149 分支 chip 同律): schema
                  无 defaultBranch 列、无 PATCH 端点,读面固定 main;chevron 保
                  r2 24c 捕获形状。非交互元素——不再是死钮。 */}
              <span className="prj-set-branch flex h-7 items-center gap-1.5 rounded-none border border-(--border-default) bg-(--surface-elevated) px-2.5 font-mono text-xs text-(--text-primary) [&_svg]:text-(--text-tertiary)">
                {project?.defaultBranch ?? 'main'}
                <ChevronDown width={12} height={12} />
              </span>
            </PanelValue>
          </PanelRow>
          <PanelRow className="min-h-12 px-4 py-1.5">
            <PanelLabel className="leading-5">{t('描述')}</PanelLabel>
            <PanelValue className={`${VALUE_CLS} text-(--text-tertiary)`}>
              {project?.description ?? t('尚无描述')}
              <SquarePen width={14} height={14} />
            </PanelValue>
          </PanelRow>
        </Panel>
        {/* 危险操作区(#207 复活): #189 DELETE /api/projects/:id 已落地,
            卡面 = #177 整除前形状原样归位(r2 24c),钮接真确认流。 */}
        <div className="mt-4 mb-2 text-xs leading-4 text-(--text-secondary)">{t('危险操作')}</div>
        <Panel variant="quiet" className="mt-4 overflow-hidden p-4">
          <div className="text-sm font-semibold leading-5 text-(--text-primary)">
            {t('删除项目')}
          </div>
          <div className="mt-1 text-[13px] leading-5 text-(--text-tertiary)">
            {t('将永久删除所有任务与执行记录，此操作不可恢复。')}
          </div>
          {/* XMON-25 收编：老 ui/Button danger/compact → destructive 变体
              （语义位）；实底皮肤（--danger 底 + on-accent 字 + compact 几何
              28/12/13）= DELETE_BTN_CLS utility 配方（#946 per-face 清零，
              件软底档按七通道律压回实底）。 */}
          <Button
            variant="destructive"
            className={DELETE_BTN_CLS}
            onClick={() => setDeleteOpen(true)}
          >
            {t('删除')}
          </Button>
        </Panel>
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
              mutations.deleteProject.mutate(id, {
                onSuccess: () => navigate('/app'),
                // #638：确认层已关，失败 = 项目还在却零解释。
                onError: (error) => toastError(t('删除项目失败，请重试。'), error),
              });
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
