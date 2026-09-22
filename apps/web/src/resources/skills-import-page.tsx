// 新建技能 route (issue #69, r2 08b/08c structure, r8 79/80 geometry): 总管 hint line, the
// 从文件夹 / 从 GitHub tablist, then either the folder form (dropzone +
// 名称 + 描述 + full-width 创建技能) or the GitHub form (链接 input + 扫描
// + help line). The tab is real state; parity scenarios pin it via the
// fixture so both captures are reproducible.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ResourceShell } from './shell.js';
import { SKILLS_HREF } from './skills-page.js';

export const SKILLS_IMPORT_HREF = '/app/resources/skills/import';

/** The two import tabs (r2 08b/08c, r8 79/80). */
const IMPORT_TABS: { id: 'folder' | 'github'; label: string }[] = [
  { id: 'folder', label: '从文件夹' },
  { id: 'github', label: '从 GitHub' },
];

export function SkillsImportPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const [tab, setTab] = useState<'folder' | 'github'>(
    () => fixture.resources?.importTab ?? 'folder',
  );

  return (
    <ResourceShell
      title="新建技能"
      href={SKILLS_IMPORT_HREF}
      selected={SKILLS_HREF}
      backHref={SKILLS_HREF}
      hideNew
      fixture={fixture}
    >
      <p className="res-import-hint">
        {t('你也可以直接让总管从 GitHub 安装技能，或帮你制作新技能。')}
      </p>
      <div className="res-tabs" role="tablist">
        {IMPORT_TABS.map(({ id, label }) => (
          <button
            type="button"
            role="tab"
            key={id}
            aria-selected={tab === id}
            className={`res-tab${tab === id ? ' res-tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      {tab === 'folder' ? (
        <div className="res-form">
          <label className="res-label" htmlFor="skill-folder">
            {t('技能文件夹')}
          </label>
          <button type="button" className="res-dropzone" id="skill-folder">
            <span className="res-dropzone-title">{t('点击或拖入技能文件夹')}</span>
            <span className="res-dropzone-sub">{t('必须包含 SKILL.md')}</span>
          </button>
          <label className="res-label" htmlFor="skill-name">
            {t('名称')}
          </label>
          <input className="res-input" id="skill-name" placeholder={t('例如：deploy')} />
          <label className="res-label" htmlFor="skill-desc">
            {t('描述')}
          </label>
          <input className="res-input" id="skill-desc" placeholder={t('简要描述该技能的功能')} />
          <button type="button" className="res-primary res-primary--block" disabled>
            {t('创建技能')}
          </button>
        </div>
      ) : (
        <div className="res-form">
          <label className="res-label" htmlFor="skill-repo">
            {t('GitHub 链接')}
          </label>
          <div className="res-scanrow">
            <input
              className="res-input"
              id="skill-repo"
              placeholder="https://github.com/owner/repo"
            />
            <button type="button" className="res-scan">
              {t('扫描')}
            </button>
          </div>
          <p className="res-help">{t('输入仓库链接以扫描其中的技能，或直接指向某个技能目录。')}</p>
        </div>
      )}
    </ResourceShell>
  );
}
