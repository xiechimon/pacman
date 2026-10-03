// 主模型覆盖 picker（#615 闭环：抽屉模型行点开即本面，选定 → PATCH chief
// model 槽 → 回显）。#751 壳换锚定弹层家族律（#67/#127：FloatingShell
// container=wrap + ClickCatcher + Esc，role=listbox/option）——#615 的居中
// DialogShell 在抽屉头触发位旁读作「在中间出现」，用户对照 .chief-switcher
// 的贴底锚定报 bug；壳换机制不换内容 + live PATCH loop 全部保留。
// #756 续（用户裁决）：搜索框不常驻——行清单 + typeahead 搜索单源归
// components/model-select-core 的 ModelPickList（开面零占位、打字现形吃字、
// 清空收回），本面只留壳与几何钩子（chief-model-pop* 类名组，正本
// chief.css）。选中行可见态单源在 model-pick-* 基类（chief.css #751 段）。

import type { ChiefCompactionModel } from '@pacman/shared';
import {
  createModelPicker,
  ModelPickList,
  type ModelRowSkin,
} from '../components/model-select-core.js';
import { FLOATING_POP_ANIM, FloatingShell } from '../components/ui/floating-shell.js';
import type { ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ClickCatcher } from '../overlays/dismiss.js';

/** r5 108 行形的类名组：比压缩弹层面多一层 col 列容器（名 + 副题纵排）。 */
const ROW_SKIN: ModelRowSkin = {
  row: 'chief-model-pick-row',
  col: 'chief-model-pick-col',
  name: 'chief-model-pick-name',
  provider: 'chief-model-pick-provider',
  check: 'chief-model-check',
};

interface ChiefModelPopoverProps {
  /** #73 retained-mount open flag。 */
  open?: boolean;
  onClose: () => void;
  /** 当前覆盖值（live = chief 封套真值）；null = 继承绑定 Agent 模型。 */
  value: ChiefCompactionModel | null;
  /** 候选模型（live = toModelOptions 投影，非 pi runtime 段）；缺省 = 仅默认行。 */
  options?: ModelOption[];
  /** live 面：选定 = PATCH chief model 槽；缺省 = fixture 律（选择即关）。 */
  onPick?: (value: ChiefCompactionModel | null) => void;
  /** 锚定包含块 = 触发行 wrap（FloatingShell container 律：portal 挂回 wrap
   *  保绝对定位几何，chief-model-select 同律）。 */
  container: HTMLElement | null;
}

export function ChiefModelPopover({
  open,
  onClose,
  value,
  options,
  onPick,
  container,
}: ChiefModelPopoverProps) {
  const { t } = useI18n();
  // 选中当前值 = 空操作关面；否则先关面再上报（律单源 model-select-core）。
  const pick = createModelPicker({ value, close: onClose, onPick });

  return (
    <FloatingShell
      open={open ?? false}
      onClose={onClose}
      container={container}
      className="chief-model-pop-shell"
      // 触发钮是 toggle（开态再点关）：Base UI 原生 outside-press 会先关、
      // 钮自身 onClick 再翻回开（#666 双写竞态）——外点关面归 ClickCatcher。
      disablePointerDismissal
    >
      <ClickCatcher onClose={onClose} />
      <div className={`chief-model-pop ${FLOATING_POP_ANIM}`}>
        <ModelPickList
          skin={ROW_SKIN}
          options={options ?? []}
          value={value}
          defaultLabel={t('默认（与绑定 Agent 相同）')}
          listLabel={t('模型')}
          searchPlaceholder={t('搜索模型…')}
          emptyLabel={t('没有匹配的模型')}
          onPick={pick}
        />
      </div>
    </FloatingShell>
  );
}
