// Team route (issue #70, r7 12): stats bar (`N 个成员` — the r7 capture's
// plan badge / upgrade link are SaaS surface this local-first self-hosted
// app does not carry, #129; the team-light visual baseline diverges here),
// the grid|chart layout tablist and the agent card grid with the dashed
// 创建 Agent slot. Head title is the team-switch dropdown trigger
// (r2 §8.1); the 设置 link sits in the head right slot (r7 12) and routes
// to the account surface — the app's only settings face (#148, 台账 #136
// team 行: 或通或隐, wired rather than hidden so the r7 12 ink survives).
// #148: the tablist is a real toggle persisted to the registered
// client-state key (r2 §1.5 `pacman.teamMembersLayout`); chart drops the
// stats bar (r2 §8.1 17c) and renders the org chart (#490). The tablist
// itself stays in both layouts — 17c shows it absent, but a toggle with no
// way back is a trap (divergence noted, 01 册 §8).
//
// #947 per-face 清零：secondary.css 退役，页内几何改挂 token utility（原值
// 等值迁移：卡 76px = h-[76px]、网格 gap 12 = gap-3、toprow 18/28 与卡片
// 766 版心同属阶梯外一次性实测值走 §3.1(a) arbitrary）。控件全部走
// components/ui 件（Button ghost 底座 + 七通道中和，#908
// comment-6001887439 裁决 3）；类名别名按 #910 裁定 1 退役，e2e 载体换
// role/text 一级 + data-testid 二级（agent 卡 = 计数锚，见卡位注）。
//
// #490: chart 此前是把 17c 捕获到的空态当成了唯一状态 —— 那份捕获的团队是
// 0 个成员，于是 chart 分支写死 暂无成员 字面量，同一份数据下与 grid 自相
// 矛盾。现在按成员数分流：0 个成员才走空态，否则由 ./team-chart.tsx 出树。
import { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router';
import {
  useApiMutations,
  useChief,
  useMembers,
  useModelSources,
  useTeams,
  useTodos,
} from '../api/hooks.js';
import { mapTeam, toDisplayTodo, toModelOptions } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { Button } from '../components/ui/button.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import { toastError } from '../components/ui/toaster.js';
import { isDeleted } from '../fixtures/deletions.js';
import { TEAM_NAME, TEAM_R7 } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ChartNetwork, ChevronDown, Grid2x2, PlusSmall } from '../icons/index.js';
import {
  SEG_GROUP_CLS,
  SEG_TAB_ACTIVE_CLS,
  SEG_TAB_CLS,
  SEG_TAB_IDLE_CLS,
} from '../pages/parts.js';
import { SecondaryShell } from '../secondary/shell.js';
import { AGENTS_HREF } from './agent-detail-page.js';
import { CreateAgentDialog } from './create-agent-dialog.js';
import { TeamChart } from './team-chart.js';

/** r2 §1.5 registered client-state key (packages/shared protocol/
 *  client-state.ts): the team view switch, grid | chart; absent = grid. */
export const TEAM_LAYOUT_STORAGE_KEY = 'pacman.teamMembersLayout';

type TeamLayout = 'grid' | 'chart';

/** 差额并项：散写形字重 400（底座 font-medium）、无按下位移、无内垫。
 *  `not-aria-[haspopup]` 与底座同链，故 tailwind-merge 能直接顶掉它。 */
const BASE_DELTA = 'active:not-aria-[haspopup]:translate-y-0 font-normal px-0 leading-[inherit]';

/** 创建 Agent 槽（grid 布局）：76px 全宽虚线钮，几何是 r7 12 实测的一次性
 *  值（§3.1(a)）；ghost 件配方按七通道律就地归零（原形无 hover、方角族
 *  8px 圆角随虚线卡语言保留，与 chart 布局的虚线创建卡同族）。 */
const CREATE_SLOT_CLS =
  'h-[76px] cursor-pointer gap-2 rounded-[8px] border border-dashed border-(--input) bg-transparent text-[13px] text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) dark:hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-(--text-tertiary)';

/** Agent 卡（#485：进详情面的链接）：76px 卡盒 + radius-popover 圆角 +
 *  surface-secondary 底（#886 卡底抬档配方），hover 边框亮一档——旧规则引
 *  未定义槽 --card-border-hover 的 fallback（= --text-tertiary），等值迁移
 *  取实算值。过渡沿旧形 150ms（= --dur-fast）border-color。 */
const AGENT_CARD_CLS =
  'flex h-[76px] items-center gap-3 rounded-(--radius-popover) border border-(--border) bg-(--secondary) px-4 text-inherit no-underline transition-[border-color] duration-(--dur-fast) ease-[ease] hover:border-(--text-tertiary)';

/** 布局切换片的两个 chip（XMON-103）：底座 = components/ui/tabs 的分段档；
 *  #946：皮肤正本 = pages/parts 的 SEG_* 配方（原 pages.css
 *  `.page-tabs-group`/`.page-tab` 规则的 utility 等值——pages.css 清零后
 *  分段档皮肤由消费点配方承载，收敛进件归 #952）。#947：别名类退役，
 *  e2e 载体 = role=tab + aria-label（grid/chart）。 */
const tabClass = (active: boolean) =>
  `${SEG_TAB_CLS} ${active ? SEG_TAB_ACTIVE_CLS : SEG_TAB_IDLE_CLS}`;

function readStoredLayout(storage: Storage): TeamLayout {
  return storage.getItem(TEAM_LAYOUT_STORAGE_KEY) === 'chart' ? 'chart' : 'grid';
}

export function TeamPage() {
  const { t } = useI18n();
  // the 设置 link carries the scenario string along like the shell's back
  // chevron, so dev/fixture selection survives the hop
  const { search } = useLocation();
  const fixture = resolveScenario(new URLSearchParams(search));
  // M5 live：成员/Agent 网格 = GET members 真值（r5 §1：Agent 列表实际走
  // members，memberType:"agent" 行内嵌 actor）；团队名 = GET /api/teams。
  const { live, teamId } = useLiveData();
  const membersQ = useMembers(teamId, live);
  const teamsQ = useTeams(live);
  const todosQ = useTodos(teamId, live);
  const team = live && membersQ.data ? mapTeam(membersQ.data) : (fixture.team ?? TEAM_R7);
  const teamName = live ? (teamsQ.data?.[0]?.name ?? TEAM_NAME) : TEAM_NAME;
  // #490: 组织图的根 = 总管绑定的 agent。live 直读 GET chief 的
  // chief.agent.agentId；fixture 走场景里的 chief.agent.id；未绑定 → null，
  // 此时 TeamChart 退到首个成员当根。
  const chiefQ = useChief(teamId, live);
  const chiefAgentId = live
    ? (chiefQ.data?.chief.agent?.agentId ?? null)
    : (fixture.chief?.agent?.id ?? null);
  const [layout, setLayout] = useState<TeamLayout>(() => readStoredLayout(localStorage));
  const switchLayout = useCallback((next: TeamLayout) => {
    setLayout(next);
    localStorage.setItem(TEAM_LAYOUT_STORAGE_KEY, next);
  }, []);
  // #170: the 创建 Agent slot opens the dialog-family form; live submit =
  // POST agents then close (invalidateAll refetches members → the new
  // agent card lands in the grid), fixture = accept-dialog 律 (close only)
  const mutations = useApiMutations(teamId);
  const [createOpen, setCreateOpen] = useState(false);
  // #485: 创建弹窗的模型候选——数据源与投影同 Agent 详情页概览（同一份
  // toModelOptions；#770 起 providers 段已除，只剩 model-sources 非 pi 段）。
  // 清单非空 = 弹窗出模型选择器；空 = 落「配置服务商」告警行（原版 capture 20 态）。
  const modelSourcesQ = useModelSources(teamId, live);
  const modelOptions = live
    ? toModelOptions(modelSourcesQ.data?.sources ?? [])
    : toModelOptions(fixture.resources?.providerSources ?? []);
  return (
    <SecondaryShell
      route="team"
      fixture={live ? { ...fixture, todos: (todosQ.data ?? []).map(toDisplayTodo) } : fixture}
      sidebarSelected="team"
      title={
        <>
          {teamName}
          <ChevronDown width={12} height={12} />
        </>
      }
      right={
        <Link
          className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-(--card-button)"
          to={{ pathname: '/app/account', search }}
          aria-label={t('设置')}
        >
          {t('设置')}
        </Link>
      }
    >
      <div className="mt-[18px] flex h-7 items-center justify-between">
        {layout === 'grid' && (
          <div className="flex items-center">
            <span className="mr-1.5 text-xs text-(--text-secondary)">
              {t('{n} 个成员', { n: team.members })}
            </span>
          </div>
        )}
        {/* XMON-103：分段控制器正本 = components/ui/tabs 的 segmented 档；
            #946 起皮肤 = pages/parts 的 SEG_* 配方（原 pages.css
            `.page-tabs-group`/`.page-tab` 规则的 utility 等值，值零改动）。
            受控 value/onValueChange 落回 switchLayout（照旧写
            localStorage），role=tablist/tab 与 aria-selected 由 Base UI
            承载。#947：别名类退役，e2e 载体 = role=tab + aria-label
            （grid/chart）；chart 布局下 stats bar 退场，ml-auto 把 tablist
            顶回 r7 12 的右缘（旧 --chart 后代选择器的等值迁移）。 */}
        <Tabs
          value={layout}
          onValueChange={(value) => switchLayout(value as TeamLayout)}
          className={layout === 'chart' ? 'ml-auto' : undefined}
        >
          <TabsList variant="segmented" className={SEG_GROUP_CLS}>
            <TabsTrigger value="grid" className={tabClass(layout === 'grid')} aria-label="grid">
              <Grid2x2 />
            </TabsTrigger>
            <TabsTrigger value="chart" className={tabClass(layout === 'chart')} aria-label="chart">
              <ChartNetwork />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {layout === 'grid' ? (
        <div className="mt-[9px] grid grid-cols-2 gap-3" data-testid="team-agent-grid">
          {/* #485: 卡是进 Agent 详情编辑面的入口（r3 §4「团队页点 Agent 卡
              进入」）。卡片由 div 改 Link —— 推翻 a3 审计把它归类为「卡表面
              非控件」（report-pages.md:88）的裁决：原版点得进，本仓此前点不
              进，Agent 建出来就再也够不着编辑面。link 反馈态 = 边框亮一档
              （AGENT_CARD_CLS）。scenario 随行（#121 Link 律）。
              data-testid="team-agent-card" = #910 二级载体（resource-row
              同款）：卡的计数锚——页面上 role=link 还有侧栏/头部动作，
              计数与按名过滤需要域内锚。 */}
          {/* fixture 删除覆面（#66 deletions，#207 侧栏项目行先例）：删掉的 Agent 卡
              随行隐去，reload 还原；live 面名单 = invalidateAll 重取 members 真值。 */}
          {team.agents
            .filter((agent) => !isDeleted(agent.id))
            .map((agent) => (
              <Link
                key={agent.id}
                className={AGENT_CARD_CLS}
                data-testid="team-agent-card"
                to={{ pathname: `${AGENTS_HREF}/${agent.id}`, search }}
              >
                <span className="flex size-[52px] flex-none items-center justify-center overflow-hidden rounded-full bg-(--secondary) [&_img]:size-[52px]">
                  <SeededAvatar
                    name={agent.displayName}
                    src={agent.avatarUrl}
                    fallback="/avatar-robot-1.svg"
                  />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm leading-[18px] font-medium text-(--foreground)">
                    {agent.displayName}
                  </span>
                  <span className="text-[11px] leading-[18px] text-(--text-tertiary)">
                    {agent.model}
                    {agent.isDefault ? t(' · 默认') : ''}
                  </span>
                  {/* 职责行墨 --text-dim → --text-tertiary（#947 实测换槽，
                      #908 裁决 2）：dim×surface-secondary 亮模 2.73 低于 12px
                      文本 floor 4.5（drive-947 E 面），tertiary 同对实测
                      5.98/6.55；token 值零改动。 */}
                  <span className="text-xs leading-4 text-(--text-tertiary)">
                    {agent.role ?? t('未设置职责')}
                  </span>
                </span>
              </Link>
            ))}
          {/* #170: the dialog family form (r2 §8.1 capture 20) lives in
              create-agent-dialog.tsx — DialogShell law, POST agents on live. */}
          <Button
            variant="ghost"
            className={`${CREATE_SLOT_CLS} ${BASE_DELTA}`}
            onClick={() => setCreateOpen(true)}
          >
            <span className="flex size-5 items-center justify-center rounded-full border border-current">
              {/* size-3 挂字形本体（件基类 [&_svg:not([class*='size-'])]:size-4
                  的 :not 守卫让位给自带 size-* 类的 svg；wrapper 档特异性不够，
                  #952 实测 16px 后与 chart 创建槽同轮修正）。 */}
              <PlusSmall className="size-3" />
            </span>
            {t('创建 Agent')}
          </Button>
        </div>
      ) : (
        <TeamChart
          agents={team.agents}
          chiefAgentId={chiefAgentId}
          onCreate={() => setCreateOpen(true)}
        />
      )}
      <CreateAgentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        modelOptions={modelOptions}
        onCreate={
          live
            ? (input) =>
                mutations.createAgent.mutate(input, {
                  onSuccess: () => setCreateOpen(false),
                  // #638：失败 = 弹窗留着（关挂在 onSuccess）但零反馈。
                  onError: (error) => toastError(t('创建 Agent 失败，请重试。'), error),
                })
            : undefined
        }
      />
    </SecondaryShell>
  );
}
