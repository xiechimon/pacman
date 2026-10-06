// AI 审核模态（M7 #312 / r8 §2.5/§3.1）：560 宽居中（448 弹层律之外新档） +
// 搜索行 + Agent 行（头像 + 名 + 厂商 · 模型；选中行 bg-indigo-500/10）+ 独立
// 性提示行（#509）+ 可选关注点 textarea + 32×32「开始审核」按钮。点击「开始
// 审核」→ POST /api/builds/{id}/steps {action:"review", agentId, focus?};server
// 入队审核步 + 时间线插 REVIEW_ANNOUNCEMENT（r8 §3.1 实测）→ phase 留
// confirm/review（审核步是额外 agent 步，不推进主时序），chip 文案切「审核
// 中」、composer placeholder 切「AI 审核进行中…」、停止钮复用 steer（#308）。
//
// 选人（#509）：默认选中经 producerProvider 跨厂商优先（判定规则单源 =
// review-default.ts，默认值与用户改选共用同一条比较），本组件只负责在选中项
// **不构成独立复核**时出声——同源与无法判定分两档措辞，都不静默。判定规则不在
// 服务端：用户显式改选同厂商照常发起。

import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { Input } from '../components/ui/input.js';
import { Textarea } from '../components/ui/textarea.js';
import { useI18n } from '../i18n/provider.js';
import { classifyReviewChoice } from './review-default.js';

/** #951（detail/overlays.css 清零）：关注点/打回反馈 textarea 皮律（原
 *  .review-focus-input，dlg-form-input 几何的 textarea 形态：80 最小高 +
 *  12 垫 / card-border 描边方角 / surface 底 / 14/20 primary 墨 / resize
 *  vertical）等值迁 utility；review 与 reject 两消费面共用单源。件底座差额
 *  中和（#945 律）：field-sizing 回 fixed（rows=3 律）、过渡/ring 清零、
 *  占位墨回 UA 值、:focus 缝色对齐老 --focus-ring 律、dark 底并回 surface。 */
export const FOCUS_TEXTAREA =
  'min-h-[80px] resize-y rounded-none border-(--card-border) bg-(--surface) p-3 text-sm leading-5 text-(--text-primary) field-sizing-fixed transition-none placeholder:text-[color:revert] focus:border-(--focus-ring) focus-visible:border-(--focus-ring) focus-visible:ring-0 dark:bg-(--surface)';

/** #951：标签 + 控件纵向行（原 .review-focus-row，6 gap）。 */
export const FOCUS_ROW = 'flex flex-col gap-1.5';

/** AI 审核选择器行最小投影（live = members 读面投影 + 厂商槽 + 模型槽；
 * fixture = canon 单默认行）。 */
export interface ReviewAgentOption {
  id: string;
  name: string;
  /** 模型标识（如「sonnet」）；fixture 面 canon 字符串 `默认`。 */
  model: string;
  /** 服务商归属（members 读面 actor.provider）；null = 未配置，不参与跨厂商
   *  判定。 */
  provider: string | null;
}

interface ReviewDialogProps {
  /** #73 retained-mount open flag。 */
  open?: boolean;
  onClose: () => void;
  /** 候选 Agent 集（live = members 读面 memberType:"agent" 行 + agent.modelId；
   * fixture 面 = canon 单默认行）；缺省 = fixture 兜底。 */
  agents?: ReviewAgentOption[];
  /** 默认选中行 id（live = 跨厂商优先判定结果；fixture = canon 单默认）。 */
  defaultAgentId?: string;
  /** 产出步 Agent 的 provider（#509）。undefined = 本面不做独立性判定
   *  （fixture 兜底面）；null = 已判定但无基准（任务未指派产出 Agent）。 */
  producerProvider?: string | null;
  /** 开始审核点击：POST steps {action:"review", agentId, focus?} 入队审核步。
   * 缺省 = fixture 静态面（仅关闭即止，不触发）。 */
  onStart?: (input: { agentId: string; focus: string }) => void;
}

const DEFAULT_AGENT: ReviewAgentOption = {
  id: 'r3-builder',
  name: 'r3-builder',
  model: '默认',
  provider: null,
};

export function ReviewDialog({
  open,
  onClose,
  agents,
  defaultAgentId,
  producerProvider,
  onStart,
}: ReviewDialogProps) {
  const { t } = useI18n();
  const source = agents ?? [DEFAULT_AGENT];
  // 搜索态（r8 §2.5 搜索行实测）；空串视为不过滤。
  const [query, setQuery] = useState('');
  // 选中态（r8 §2.5「选中行 bg-indigo-500/10」）；retained-mount 重开回 default。
  const [selected, setSelected] = useState<string>(defaultAgentId ?? source[0]?.id ?? '');
  // 可选关注点 textarea（M7 #312 票 A 票面规格：r8 §3.1 实测有 textarea + 工具
  // 条；具体工具条配置 [推断] —— 票 A 不消费，本票只挂空容器）。
  const [focus, setFocus] = useState('');
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(defaultAgentId ?? source[0]?.id ?? '');
      setFocus('');
    }
  }, [open, defaultAgentId, source]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q === '' ? source : source.filter((row) => row.name.toLowerCase().includes(q));
  }, [source, query]);

  // 独立性提示（#509）：跟手**当前选中**（用户改选后立即重判，票面 story 4），
  // 判定走 review-default 的同一条比较规则，本处只做措辞分档。跨厂商 = 无提
  // 示；同源 / 无法判定各一档，都不静默（票面「降级要出声」）。
  const notice = useMemo(() => {
    if (producerProvider === undefined) return null;
    const row = source.find((candidate) => candidate.id === selected);
    if (row === undefined) return null;
    const verdict = classifyReviewChoice(row, producerProvider);
    return verdict === 'cross-vendor' ? null : verdict;
  }, [producerProvider, source, selected]);

  const submit = () => {
    if (selected === '') return;
    onStart?.({ agentId: selected, focus: focus.trim() });
    onClose();
  };

  return (
    <DialogShell
      title={t('AI 审核')}
      open={open}
      onClose={onClose}
      width={560}
      footer={
        // #945（正典表 §5.4）：.dlg-form-foot/.dlg-form-actions 别名退役，
        // 容器律走 utility（foot = flex-col px-4 pb-4，actions = 右对齐
        // gap-2）；取消钮 .chief-dlg-ghost → Button outline 档（§5.4 正典
        // 迁移位：旧 card-border 描边 + surface 底 ≈ outline 档
        // border-border/bg-background，#915 翻值后自动对齐新色板）。
        <div className="flex flex-col px-4 pb-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="cursor-pointer active:not-aria-[haspopup]:translate-y-0"
              onClick={onClose}
            >
              {t('取消')}
            </Button>
            {/* 开始审核 = brand（老 primary/compact h28 px12 @13px 漆面逐值
                utilities，XMON-24 原样）；review-start 别名随 #951 退役
                （其规则在 overlays.css 本就是空壳，几何全在这串 utility）。 */}
            <Button
              variant="brand"
              className="h-7 border-none px-3 text-[13px] font-normal cursor-pointer active:not-aria-[haspopup]:translate-y-0"
              onClick={submit}
              disabled={selected === ''}
            >
              {t('开始审核')}
            </Button>
          </div>
        </div>
      }
    >
      {/* #951（overlays.css 清零）：review 面律等值迁 utility——body 12 gap
          16 垫；搜索行 36 高 card-border 描边方角 surface 底 12 横垫。 */}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex h-9 items-center rounded-none border border-(--card-border) bg-(--surface) px-3">
          {/* XMON-24：搜索框切 registry Input；#951：.review-search-input
              per-face 皮律（flex1/无边框/无底/14px primary 墨/outline none）
              等值迁 utility。老面是 UA 裸 input：1px 2px 内边距、normal 行高、
              UA 占位灰——utilities 逐条还原（placeholder 用 revert 落回 UA
              值，focus ring 清零；dark 底并回 none）。 */}
          <Input
            className="h-auto flex-1 rounded-none border-none bg-transparent px-[2px] py-px text-sm leading-normal text-(--text-primary) md:leading-normal placeholder:text-[color:revert] focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('搜索 Agent…')}
          />
        </div>
        <div
          className="flex max-h-[200px] flex-col gap-2.5 overflow-y-auto"
          role="listbox"
          aria-label={t('选择审核 Agent')}
        >
          {rows.length === 0 ? (
            <div className="p-4 text-center text-[13px] text-(--text-tertiary)">
              {t('没有匹配的 Agent')}
            </div>
          ) : (
            rows.map((row) => {
              const isSelected = row.id === selected;
              return (
                // XMON-24：agent 行钮切 shadcn ghost；#951：.review-agent-row
                // per-face 律等值迁 utility——64 高 / 12 gap / 16 横垫 /
                // card-border 描边 8 圆角 / surface 漆底灭 hover 底（含 dark
                // 档），[data-on] 选中档 --spot-soft（r8 §2.5 实测，spot 14%
                // mix）同压 hover；utilities 清 justify（w 撑满行内容靠左）、
                // 字重与 active 位移。role/aria-selected/data-on 直通。
                <Button
                  variant="ghost"
                  key={row.id}
                  className="h-16 cursor-pointer justify-start gap-3 rounded-[8px] border border-(--card-border) bg-(--surface) px-4 text-left text-sm text-(--text-primary) font-normal hover:bg-(--surface) hover:text-(--text-primary) dark:hover:bg-(--surface) dark:hover:text-(--text-primary) data-[on=true]:bg-(--spot-soft) data-[on=true]:hover:bg-(--spot-soft) active:not-aria-[haspopup]:translate-y-0"
                  data-on={isSelected}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setSelected(row.id)}
                >
                  <span
                    className="grid size-9 flex-none place-items-center rounded-full border border-(--border-default) bg-(--surface-secondary) text-sm text-(--text-secondary)"
                    aria-hidden="true"
                  >
                    {row.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm text-(--text-primary)">{row.name}</span>
                    <span className="text-[length:12px] text-(--text-tertiary)">
                      {row.provider === null ? row.model : `${row.provider} · ${row.model}`}
                    </span>
                  </span>
                </Button>
              );
            })
          )}
        </div>
        {/* 独立性提示行（#509）：同源与无法判定两档共用本容器（两档只差文案，
            不做红黄分色）。左缘 amber 竖条与 chat-review-finding--suggestion
            同色，读作「留意」而非「出错」；#951 律等值迁 utility（3px
            badge-attention 左条 / 6 圆角 / surface-secondary 底 / 10+12 垫）。 */}
        {notice === null ? null : (
          <div
            className="flex flex-col gap-1 rounded-[6px] border-l-[3px] border-(--badge-attention) bg-(--surface-secondary) px-3 py-2.5"
            role="status"
          >
            <span className="text-[13px] font-semibold text-(--text-primary)">
              {notice === 'same-vendor' ? t('本次审核与产出同源') : t('无法判定审核独立性')}
            </span>
            <span className="text-[length:12px] leading-[1.5] text-(--text-secondary)">
              {notice === 'same-vendor'
                ? t('审核人与产出该方案的 Agent 来自同一模型厂商，不构成独立复核。')
                : t(
                    '产出该方案的 Agent 或所选审核人未配置模型厂商，缺少比对基准，不构成独立复核。',
                  )}
            </span>
          </div>
        )}
        <div className={FOCUS_ROW}>
          {/* #945（正典表 §5.4）：.dlg-form-label 别名退役——标签律 =
              --label-size/--label-spacing 定版 token utility。 */}
          <span className="mt-[9px] mb-2 text-(length:--label-size) leading-[18px] tracking-(--label-spacing) text-(--text-primary)">
            {t('希望 Agent 审核时重点关注什么？（可选）')}
          </span>
          {/* #945（#851 裸控件账）：裸 textarea 收编 components/ui
              Textarea；#951：皮肤正本随 overlays.css 清零等值迁
              FOCUS_TEXTAREA utility（几何零漂移，中和律见常量头注）。 */}
          <Textarea
            className={FOCUS_TEXTAREA}
            value={focus}
            onChange={(event) => setFocus(event.target.value)}
            rows={3}
            placeholder={t('希望 Agent 审核时重点关注什么？（可选）')}
          />
        </div>
      </div>
    </DialogShell>
  );
}
