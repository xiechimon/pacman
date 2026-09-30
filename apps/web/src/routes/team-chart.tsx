// team chart 组织图 —— 照 todos.dev/app/team 的 chart 布局现场实测重建
// （2026-09-30 DOM 实测）。r7 12 那份捕获的团队是 0 个成员，只留下「暂无成员」
// 空态，树结构从未出现在旧语料里 —— 旧实现把那份空态当成了 chart 的唯一状态。
//
// 树形是渲染约定，不是数据：members 载荷没有层级字段（只有 memberType /
// role / provider / modelId / description），所以根 = 总管绑定的 agent
// （GET teams/{id}/chief 的 chief.agent.agentId），未绑定时退首个成员；其余
// 成员按序落子列，末位接虚线「创建 Agent」卡。
import type { SVGProps } from 'react';
import type { TeamAgentCard } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { Avatar } from '../ui/avatar.js';

/** 皇冠字形：逐字抄自参考产品 chart 根节点（`text-indigo-600`，描边 2.5）。
 *  与同栏位图标不同，它不属于 r7 图标清单（icons/ 由 generate-icons.mjs
 *  从那份清单生成），故留在此处而不入 icons/。 */
function CrownGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M7 17V13C3.5 13 3 10 5 8 5 5 8 3 12 3s7 2 7 5c2 2 1.5 5-2 5v4" />
      <rect x="7" y="17" width="10" height="3" rx=".75" />
    </svg>
  );
}

/** 服务商徽标字形：逐字抄自参考产品节点第二行（实心 currentColor）。参考账号
 *  里两个 Agent 同属一个服务商，字形一致 —— 采样不足以反推「服务商 → 字形」
 *  的映射表，故照抄实测字形而不臆造映射。 */
function ProviderGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M2 2h15v10h-5V7H2ZM2 7h5v5h5v5H7v5H2ZM17 12h5v10h-5Z" />
    </svg>
  );
}

/** 虚线卡里的加号：参考产品为 12×12 / 描边 2.5（与 icons/PlusSmall 的
 *  9×9 / 描边 3 不同号，故另抄一份）。 */
function PlusGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/** 组织图节点卡：220×56 / 圆角 8 / 1px --border-default；32 圆头像 + 两行文本
 *  （名字 12px/500，第二行 = 服务商徽标胶囊 + 10px mono 模型行）。参考产品的
 *  节点可点开编辑（本仓那条交互归 #485，此处只落结构与外观）。 */
function ChartNode({ agent, crown }: { agent: TeamAgentCard; crown?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={`team-chart-node${crown ? ' team-chart-node--root' : ''}`}>
      <span className="team-chart-avatar">
        <Avatar name={agent.displayName} src={agent.avatarUrl} fallback="/avatar-robot-1.svg" />
      </span>
      <span className="team-chart-text">
        <span className="team-chart-row">
          <span className="team-chart-name">{agent.displayName}</span>
          {crown && (
            <span className="team-chart-crown">
              <CrownGlyph />
            </span>
          )}
        </span>
        <span className="team-chart-row">
          {agent.provider ? (
            <span className="team-chart-provider">
              <ProviderGlyph />
            </span>
          ) : null}
          <span className="team-chart-model">
            {agent.model}
            {agent.isDefault ? t(' · 默认') : ''}
          </span>
        </span>
      </span>
    </div>
  );
}

/** chart 布局的整块内容：零成员 = 「暂无成员」空态（r2 §8.1 17c），否则出树。
 *  两条分支收在同一处，调用方不必自己按成员数分流。 */
export function TeamChart({
  agents,
  chiefAgentId,
  onCreate,
}: {
  agents: TeamAgentCard[];
  chiefAgentId: string | null;
  onCreate: () => void;
}) {
  const { t } = useI18n();
  const root = agents.find((a) => a.id === chiefAgentId) ?? agents[0];
  if (!root) {
    return <div className="team-chart-empty">{t('暂无成员')}</div>;
  }
  return (
    <div className="team-chart">
      <ChartNode agent={root} crown />
      <div className="team-chart-link" />
      <div className="team-chart-children">
        <div className="team-chart-bracket-col">
          <div className="team-chart-bracket" />
        </div>
        <div className="team-chart-nodes">
          {agents
            .filter((a) => a.id !== root.id)
            .map((a) => (
              <ChartNode key={a.id} agent={a} />
            ))}
          <button type="button" className="team-chart-create" onClick={onCreate}>
            <span className="team-chart-create-icon">
              <PlusGlyph />
            </span>
            {t('创建 Agent')}
          </button>
        </div>
      </div>
    </div>
  );
}
