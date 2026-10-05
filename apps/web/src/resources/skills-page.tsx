// 技能 route (issue #69, r7 08): search input + 排序 button row, then one
// card row per skill (20px orange puzzle tile, name + description, row
// chevron). Row content comes from the scenario fixture.
// #306 接真：排序钮开单选 listbox（默认/名称，当前项 ✓，行点击 = 选中即关
// — lang-dropdown 家族律）。原站排序下拉内容未观测，选项集 [设计]：SkillRow
// 数据面只有 name/description（无时间戳），可诚实承载的排序键 = 名称。
// spec 13（#367）只读面 → XMON-114（S3，spec 13 回摆）写面：技能 = server
// 本地目录现扫投影不变，但页面恢复新建/编辑——topbar「+ 新建」与空态主钮
// 开 SkillDialog（frontmatter 表单化），行点击开编辑。空态文案指路目录 +
// 界面新建双入口（canon = shared SKILL_PAGE_COPY 单源消费，{dir} =
// SKILLS_DIR_DEFAULT；env 覆写在 server 侧，i18n 键经 COMPUTED_KEYS 登记）。
import { SKILL_PAGE_COPY, SKILLS_DIR_DEFAULT } from '@pacman/shared';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSkills } from '../api/hooks.js';
import { mapSkills } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu.js';
import { Input } from '../components/ui/input.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ArrowUpDown, ChevronDown, Puzzle, Search } from '../icons/index.js';
import { EmptyState, RowCard, RowChevron, Tile } from './parts.js';
import { ResourceShell } from './shell.js';
import { SkillDialog, type SkillEditTarget } from './skill-dialog.js';

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
  const [sort, setSort] = useState<SortKind>('默认');
  const skills = sort === '名称' ? [...rows].sort((a, b) => a.name.localeCompare(b.name)) : rows;
  // 弹窗态：null = 关；{skill?} 无 skill = 新建，有 = 编辑（XMON-114）。
  const [dialog, setDialog] = useState<{ skill?: SkillEditTarget } | null>(null);
  const openCreate = () => setDialog({});

  return (
    <ResourceShell
      title="技能"
      href={SKILLS_HREF}
      backHref="/app"
      selected={SKILLS_HREF}
      onNew={openCreate}
      fixture={fixture}
    >
      {skills.length === 0 ? (
        // r2 08: the empty state replaces the search row entirely；spec 13
        // 回摆（XMON-114）：双入口口径——主钮开新建弹窗，文案指路目录 +
        // 界面新建（canon = SKILL_PAGE_COPY，{dir} 插值；en 翻译键 = 同串，
        // i18n-coverage COMPUTED_KEYS 登记）。
        <EmptyState
          Icon={Puzzle}
          title={SKILL_PAGE_COPY.empty}
          description={SKILL_PAGE_COPY.directoryHint}
          descriptionVars={{ dir: SKILLS_DIR_DEFAULT }}
          actionLabel="新建技能"
          onAction={openCreate}
        />
      ) : (
        <>
          <div className="res-searchrow">
            {/* #423 真 Input 收编（#422 裁决：原「搜索框」是 div + 占位 span，
                .res-search-ph 连 CSS 都没有 → 换真 Input 零样式债）：盒形仍由
                .res-search per-face 规则承载，input 本体零装饰
                （.res-search-input），focus 环走 #388 家族律。过滤行为无行为
                票，本面 = 真输入框（原为纯装饰），占位文案同键单源。 */}
            <div className="res-search">
              <Search width={13} height={13} />
              <Input
                className="res-search-input"
                type="text"
                placeholder={t('搜索技能...')}
                aria-label={t('搜索技能...')}
              />
            </div>
            {/* #854 收编 dropdown-menu（Base UI Menu RadioGroup，#714
                playbook）：单选即关走显式 closeOnClick；勾形改由
                RadioItemIndicator 原生槽承载；定位正本迁 Positioner 参数
                （side=bottom align=end sideOffset=8）。 */}
            <span className="res-sort-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger render={<button type="button" className="res-sort" />}>
                  <ArrowUpDown width={13} height={13} />
                  <span>{t('排序')}</span>
                  <ChevronDown width={12} height={12} />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="bottom"
                  sideOffset={8}
                  aria-label={t('排序')}
                  className="res-sort-menu"
                >
                  <DropdownMenuRadioGroup
                    value={sort}
                    onValueChange={(next) => setSort(next as SortKind)}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem
                        key={option}
                        value={option}
                        closeOnClick
                        className="res-sort-row [&_svg:not([class*='size-'])]:size-auto"
                      >
                        <span>{t(option)}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </div>
          {skills.map((skill) => (
            <RowCard
              key={skill.name}
              onOpen={() =>
                setDialog({
                  skill: { id: skill.name, name: skill.name, description: skill.description },
                })
              }
            >
              <Tile Icon={Puzzle} size="sm" tone="orange" />
              <span className="res-row-text">
                <span className="res-row-title">{skill.name}</span>
                <span className="res-row-desc res-row-desc--strong">{skill.description}</span>
              </span>
              <RowChevron />
            </RowCard>
          ))}
        </>
      )}
      <SkillDialog open={dialog !== null} onClose={() => setDialog(null)} skill={dialog?.skill} />
    </ResourceShell>
  );
}
