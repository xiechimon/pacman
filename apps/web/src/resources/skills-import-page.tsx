// 新建技能 route (issue #69, r2 08b/08c structure, r8 79/80 geometry): 总管 hint line, the
// 从文件夹 / 从 GitHub tablist, then either the folder form (dropzone +
// 名称 + 描述 + full-width 创建技能) or the GitHub form (链接 input + 扫描
// + help line). The tab is real state; parity scenarios pin it via the
// fixture so both captures are reproducible.
// #83 (M5) live：文件夹表单接真 POST /api/skills（dropzone → 目录选择 →
// 文件集读取，SKILL.md 必含校验 = server 400 同款；创建成功回技能列表）。
// #235 live：GitHub 扫描钮接 #223 的 POST /api/skills/scan 双模式端点——
// 扫描（候选发现）→ 候选列表 → 点候选行 = fetch 模式取文件集（与
// POST /api/skills body.files 同形）→ createSkill 既有文件集语义（#195）
// 导入成功回技能列表。fixture 面 DOM 保持零变化（parity scenario 80 守）。

import type { SkillCandidate } from '@pacman/shared';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApiMutations } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
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
  // GitHub tab（#235 live）：repo 输入 + 扫描结果 + 导入中候选 path。
  const [repo, setRepo] = useState('');
  const [importing, setImporting] = useState<string | null>(null);
  const scan = mutations.scanSkills;
  const fetchFiles = mutations.fetchSkillFiles;
  const importError = fetchFiles.error ?? mutations.createSkill.error;
  /** 选中即导入：fetch 模式取文件集 → 既有 createSkill 文件集语义。 */
  const importCandidate = async (cand: SkillCandidate) => {
    const scanned = scan.data;
    if (scanned == null) return;
    setImporting(cand.path);
    try {
      const fetched = await fetchFiles.mutateAsync({ repo: scanned.repo, path: cand.path });
      mutations.createSkill.mutate(
        { name: cand.name, description: cand.description, files: fetched.files },
        {
          onSuccess: () => navigate(SKILLS_HREF),
          onSettled: () => setImporting(null),
        },
      );
    } catch {
      setImporting(null); // 错误行经 fetchFiles.error 渲染
    }
  };
  const startScan = () => {
    // 重扫清旧导入链错误（导入错误行挂在候选区，随新结果重渲染）。
    fetchFiles.reset();
    mutations.createSkill.reset();
    scan.mutate({ repo: repo.trim() });
  };
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
          <Input
            className="res-input"
            id="skill-name"
            placeholder={t('例如：deploy')}
            {...(live ? { value: name, onChange: (e) => setName(e.target.value) } : {})}
          />
          <label className="res-label" htmlFor="skill-desc">
            {t('描述')}
          </label>
          <Input
            className="res-input"
            id="skill-desc"
            placeholder={t('简要描述该技能的功能')}
            {...(live ? { value: desc, onChange: (e) => setDesc(e.target.value) } : {})}
          />
          <Button
            variant="primary"
            size="standard"
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
          </Button>
        </div>
      ) : (
        <div className="res-form">
          <label className="res-label" htmlFor="skill-repo">
            {t('GitHub 链接')}
          </label>
          <div className="res-scanrow">
            <Input
              className="res-input"
              id="skill-repo"
              placeholder="https://github.com/owner/repo"
              {...(live ? { value: repo, onChange: (e) => setRepo(e.target.value) } : {})}
            />
            <button
              type="button"
              className="res-scan"
              {...(live
                ? {
                    // 导入中禁扫描：重扫 reset 导入链 mutation 会在 mid-flight
                    // 清态（onSettled 仍放行 importing），直接禁掉消竞态。
                    disabled: scan.isPending || importing !== null || repo.trim() === '',
                    onClick: startScan,
                  }
                : {})}
            >
              {live && scan.isPending ? t('扫描中…') : t('扫描')}
            </button>
          </div>
          <p className="res-help">{t('输入仓库链接以扫描其中的技能，或直接指向某个技能目录。')}</p>
          {live && scan.isError && (
            <p className="res-help res-error">
              {t('扫描失败')}：{scan.error.message}
            </p>
          )}
          {live && scan.data != null && (
            <div className="res-candlist">
              {scan.data.candidates.length === 0 ? (
                <p className="res-help">{t('未发现技能。')}</p>
              ) : (
                scan.data.candidates.map((cand) => (
                  <button
                    key={cand.path}
                    type="button"
                    className="res-cand"
                    disabled={importing !== null}
                    onClick={() => void importCandidate(cand)}
                  >
                    <span className="res-cand-name">{cand.name}</span>
                    {cand.description != null && (
                      <span className="res-cand-desc">{cand.description}</span>
                    )}
                    {cand.path !== '' && <span className="res-cand-path">{cand.path}</span>}
                  </button>
                ))
              )}
              {scan.data.truncated && (
                <p className="res-help">{t('结果已截断，仅显示部分候选。')}</p>
              )}
              {importing !== null && <p className="res-help">{t('导入中…')}</p>}
              {importError != null && (
                <p className="res-help res-error">
                  {t('导入失败')}：{importError.message}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </ResourceShell>
  );
}
