// Project settings route (issue #71, r2 24c): 基本信息|仓库|标签 tab group,
// one card — avatar circle + 更换 link, then 名称/仓库/目标分支/描述 rows —
// and the 危险操作 card with the 删除项目 primary-danger button (24d dialog
// is an overlay ticket, not this route).
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { PROJECT_INITIAL } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { ChevronDown, SquarePen } from '../icons/index.js';
import { PageShell, TabGroup } from './shell.js';
import './pages.css';

const TABS = [
  { id: 'basic', label: '基本信息' },
  { id: 'repo', label: '仓库' },
  { id: 'tags', label: '标签' },
];

export function ProjectSettingsPage() {
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const [tab, setTab] = useState('basic');
  const project = fixture.project;
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
            <button type="button" className="prj-set-change">
              更换
            </button>
          </div>
          <div className="prj-set-row">
            <span className="prj-set-label">名称</span>
            <span className="prj-set-value">
              {project?.name ?? ''}
              <SquarePen width={14} height={14} />
            </span>
          </div>
          <div className="prj-set-row">
            <span className="prj-set-label">仓库</span>
            <span className="prj-set-value">
              {project?.repoName ?? ''}
              {project?.hosted === true && <span className="prj-set-chip">Todos 托管</span>}
            </span>
          </div>
          <div className="prj-set-row">
            <span className="prj-set-label">目标分支</span>
            <span className="prj-set-value">
              <button type="button" className="prj-set-branch">
                {project?.defaultBranch ?? 'main'}
                <ChevronDown width={12} height={12} />
              </button>
            </span>
          </div>
          <div className="prj-set-row">
            <span className="prj-set-label">描述</span>
            <span className="prj-set-value prj-set-value--dim">
              {project?.description ?? '尚无描述'}
              <SquarePen width={14} height={14} />
            </span>
          </div>
        </div>
        <div className="prj-set-danger-label">危险操作</div>
        <div className="prj-set-card prj-set-card--danger">
          <div className="prj-set-danger-title">删除项目</div>
          <div className="prj-set-danger-desc">将永久删除所有任务与执行记录，此操作不可恢复。</div>
          <button type="button" className="prj-set-delete">
            删除
          </button>
        </div>
      </div>
    </PageShell>
  );
}
