// New-project route (issue #71, r2 07): centered 768 column — avatar
// placeholder tile + caption, 项目名称 input, 仓库 selector row, full-width
// 创建项目 primary (disabled until the form is filled, r2 07 muted indigo).
// #83 (M5) live：名称受控 + 创建 = POST /api/projects（repoKind hosted，
// 02 §3 托管 bare 落地）→ 跳项目页；仓库 selector（GitHub 接入弹窗）归后票，
// 保持占位。fixture 面不变（disabled 静态形）。
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApiMutations } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronRight, ImageFrame } from '../icons/index.js';
import { PageShell } from './shell.js';
import './pages.css';

export function ProjectNewPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const { live, teamId } = useLiveData();
  const navigate = useNavigate();
  const mutations = useApiMutations(teamId);
  const [name, setName] = useState('');
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
        <button type="button" id="prj-new-repo" className="prj-new-repo">
          <span className="prj-new-repo-placeholder">{t('选择仓库')}</span>
          <ChevronRight width={14} height={14} />
        </button>
        <button
          type="button"
          className="prj-new-submit"
          disabled={live ? name.trim() === '' : true}
          onClick={
            live
              ? () =>
                  mutations.createProject.mutate(
                    { name: name.trim(), repoKind: 'hosted' },
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
