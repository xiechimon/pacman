// 技能 route (issue #69, r7 08): search input + 排序 button row, then one
// card row per skill (20px orange puzzle tile, name + description, row
// chevron). Row content comes from the scenario fixture.
// #306 接真：排序钮开单选 listbox（默认/名称，当前项 ✓，行点击 = 选中即关
// — lang-dropdown 家族律）。原站排序下拉内容未观测，选项集 [设计]：SkillRow
// 数据面只有 name/description（无时间戳），可诚实承载的排序键 = 名称。
// spec 13（#367）只读面：技能 = server 本地目录现扫投影（id = frontmatter
// name 回落目录名），页面无新建/导入动作——写技能 = 往技能目录放文件，
// 空态文案指路目录（文案 canon = shared SKILL_PAGE_COPY 单源消费，{dir} =
// SKILLS_DIR_DEFAULT；env 覆写在 server 侧，i18n 键经 COMPUTED_KEYS 登记）。
import { SKILL_PAGE_COPY, SKILLS_DIR_DEFAULT } from '@pacman/shared';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSkills } from '../api/hooks.js';
import { mapSkills } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { FloatingShell } from '../components/ui/floating-shell.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ArrowUpDown, Check, ChevronDown, Puzzle, Search } from '../icons/index.js';
import { ClickCatcher } from '../overlays/dismiss.js';
import { EmptyState, RowChevron, Tile } from './parts.js';
import { ResourceShell } from './shell.js';

export const SKILLS_HREF = '/app/resources/skills';

/** #306 [设计]: the two honest sorts — server (arrival) order and name. */
const SORT_OPTIONS = ['默认', '名称'] as const;
type SortKind = (typeof SORT_OPTIONS)[number];

export function SkillsPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  // M5 live：GET /api/skills?teamId=（02 §6.1 词表；spec 13 起 server 现扫
  // 本地目录，wire 形状不变）。
  const { live, teamId } = useLiveData();
  const skillsQ = useSkills(teamId, live);
  const rows = live ? mapSkills(skillsQ.data ?? []) : (fixture.resources?.skills ?? []);
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState<SortKind>('默认');
  // #425 B1:wrap 锚定面——portal 挂进 wrap 保绝对定位几何;Esc 走 FloatingShell。
  const [sortWrap, setSortWrap] = useState<HTMLSpanElement | null>(null);
  const skills = sort === '名称' ? [...rows].sort((a, b) => a.name.localeCompare(b.name)) : rows;

  return (
    <ResourceShell
      title="技能"
      href={SKILLS_HREF}
      backHref="/app"
      selected={SKILLS_HREF}
      hideNew
      fixture={fixture}
    >
      {skills.length === 0 ? (
        // r2 08: the empty state replaces the search row entirely；spec 13：
        // 只读面——无主钮无提示行，文案指路技能目录（canon = SKILL_PAGE_COPY，
        // {dir} 插值；en 翻译键 = 同串，i18n-coverage COMPUTED_KEYS 登记）。
        <EmptyState
          Icon={Puzzle}
          title={SKILL_PAGE_COPY.empty}
          description={SKILL_PAGE_COPY.directoryHint}
          descriptionVars={{ dir: SKILLS_DIR_DEFAULT }}
        />
      ) : (
        <>
          <div className="res-searchrow">
            <div className="res-search">
              <Search width={13} height={13} />
              <span className="res-search-ph">{t('搜索技能...')}</span>
            </div>
            <span className="res-sort-wrap" ref={setSortWrap}>
              <button
                type="button"
                className="res-sort"
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
                onClick={() => setSortOpen((v) => !v)}
              >
                <ArrowUpDown width={13} height={13} />
                <span>{t('排序')}</span>
                <ChevronDown width={12} height={12} />
              </button>
              <FloatingShell
                open={sortOpen}
                onClose={() => setSortOpen(false)}
                container={sortWrap}
              >
                <ClickCatcher onClose={() => setSortOpen(false)} />
                <div className="res-sort-menu" role="listbox" aria-label={t('排序')}>
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="res-sort-row"
                      role="option"
                      aria-selected={option === sort}
                      onClick={() => {
                        setSort(option);
                        setSortOpen(false);
                      }}
                    >
                      <span>{t(option)}</span>
                      {option === sort && (
                        <span className="res-sort-check">
                          <Check width={14} height={14} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </FloatingShell>
            </span>
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
