// New-project route (issue #71, r2 07): centered 768 column — avatar
// placeholder tile + caption, 项目名称 input, 仓库 selector row, full-width
// 创建项目 primary (disabled until the form is filled, r2 07 muted indigo).
import { useSearchParams } from 'react-router';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronRight, ImageFrame } from '../icons/index.js';
import { PageShell } from './shell.js';
import './pages.css';

export function ProjectNewPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
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
        <input id="prj-new-name" className="prj-new-input" type="text" placeholder="My App" />
        <label className="prj-new-label" htmlFor="prj-new-repo">
          {t('仓库')}
        </label>
        <button type="button" id="prj-new-repo" className="prj-new-repo">
          <span className="prj-new-repo-placeholder">{t('选择仓库')}</span>
          <ChevronRight width={14} height={14} />
        </button>
        <button type="button" className="prj-new-submit" disabled>
          {t('创建项目')}
        </button>
      </div>
    </PageShell>
  );
}
