// 新建技能 route (issue #69, r2 08b/08c structure, r8 79/80 geometry): 总管 hint line, the
// 从文件夹 / 从 GitHub tablist, then either the folder form (dropzone +
// 名称 + 描述 + full-width 创建技能) or the GitHub form (链接 input + 扫描
// + help line). The tab is real state; parity scenarios pin it via the
// fixture so both captures are reproducible.
// #83 (M5) live：文件夹表单接真 POST /api/skills（dropzone → 目录选择 →
// 文件集读取，SKILL.md 必含校验 = server 400 同款；创建成功回技能列表）。
// GitHub 扫描面 = server 无对应端点（02 §6.1 POST skills 上传语义为文件
// 面），扫描钮保持惰性并登记验收报告。fixture 面 DOM/行为不变（隐藏 file
// input 零像素）。
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApiMutations } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
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
  const { live, teamId } = useLiveData();
  const navigate = useNavigate();
  const mutations = useApiMutations(teamId);
  const dirInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const canCreate = files != null && 'SKILL.md' in files && name.trim() !== '';
  const pickFolder = async (list: FileList | null) => {
    if (list == null) return;
    const out: Record<string, string> = {};
    let inferredName = '';
    for (const file of Array.from(list)) {
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const segments = rel.split('/');
      if (segments.length > 1 && inferredName === '') inferredName = segments[0] ?? '';
      out[segments.slice(1).join('/') || rel] = await file.text();
    }
    setFiles(out);
    if (name === '' && inferredName !== '') setName(inferredName);
  };

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
          <button
            type="button"
            className="res-dropzone"
            id="skill-folder"
            onClick={live ? () => dirInput.current?.click() : undefined}
          >
            <span className="res-dropzone-title">
              {files != null
                ? `${t('已选择')} ${Object.keys(files).length} ${t('个文件')}`
                : t('点击或拖入技能文件夹')}
            </span>
            <span className="res-dropzone-sub">{t('必须包含 SKILL.md')}</span>
          </button>
          {live && (
            <input
              ref={dirInput}
              type="file"
              style={{ display: 'none' }}
              // 目录选择面（webkitdirectory 非标准属性位——React 透传）
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              onChange={(e) => void pickFolder(e.target.files)}
            />
          )}
          <label className="res-label" htmlFor="skill-name">
            {t('名称')}
          </label>
          <input
            className="res-input"
            id="skill-name"
            placeholder={t('例如：deploy')}
            {...(live ? { value: name, onChange: (e) => setName(e.target.value) } : {})}
          />
          <label className="res-label" htmlFor="skill-desc">
            {t('描述')}
          </label>
          <input
            className="res-input"
            id="skill-desc"
            placeholder={t('简要描述该技能的功能')}
            {...(live ? { value: desc, onChange: (e) => setDesc(e.target.value) } : {})}
          />
          <button
            type="button"
            className="res-primary res-primary--block"
            disabled={live ? !canCreate : true}
            onClick={
              live
                ? () =>
                    mutations.createSkill.mutate(
                      {
                        name: name.trim(),
                        description: desc.trim() === '' ? null : desc.trim(),
                        files: files ?? {},
                      },
                      { onSuccess: () => navigate(SKILLS_HREF) },
                    )
                : undefined
            }
          >
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
