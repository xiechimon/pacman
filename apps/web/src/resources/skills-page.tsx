// 技能 route (issue #69, r7 08): search input + 排序 button row, then one
// card row per skill (20px orange puzzle tile, name + description, row
// chevron). Row content comes from the scenario fixture.
import { useSearchParams } from 'react-router';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ArrowUpDown, ChevronDown, Puzzle, Search } from '../icons/index.js';
import { EmptyState, RowChevron, Tile } from './parts.js';
import { ResourceShell } from './shell.js';

export const SKILLS_HREF = '/app/resources/skills';

export function SkillsPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const skills = fixture.resources?.skills ?? [];

  return (
    <ResourceShell
      title="技能"
      href={SKILLS_HREF}
      backHref="/app"
      selected={SKILLS_HREF}
      newHref={`${SKILLS_HREF}/import`}
      fixture={fixture}
    >
      {skills.length === 0 ? (
        // r2 08: the empty state replaces the search row entirely
        <EmptyState
          Icon={Puzzle}
          title="尚无技能。"
          description="技能是写给 Agent 的工作手册：一个包含 SKILL.md 的文件夹，用于将可复用的流程传授给 Agent。授予后，Agent 会在合适的任务中主动使用。"
          actionLabel="添加技能"
          hint="你也可以直接让总管从 GitHub 安装技能，或帮你制作新技能。"
        />
      ) : (
        <>
          <div className="res-searchrow">
            <div className="res-search">
              <Search width={13} height={13} />
              <span className="res-search-ph">{t('搜索技能...')}</span>
            </div>
            <button type="button" className="res-sort">
              <ArrowUpDown width={13} height={13} />
              <span>{t('排序')}</span>
              <ChevronDown width={12} height={12} />
            </button>
          </div>
          {skills.map((skill) => (
            <div className="res-card res-rowcard" key={skill.name}>
              <Tile Icon={Puzzle} size="sm" tone="orange" />
              <span className="res-row-text">
                <span className="res-row-title">{skill.name}</span>
                <span className="res-row-desc res-row-desc--strong">{skill.description}</span>
              </span>
              <RowChevron />
            </div>
          ))}
        </>
      )}
    </ResourceShell>
  );
}
