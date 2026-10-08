// FAB icon (#444): 绑定 Agent 时图标 = 该 Agent 的头像，走 Avatar 原语的
// 既有语义（avatarUrl 覆盖优先于 dicebear 生成，加载失败 onError 退静态
// 资产，不破图不跳版——原语面钉在 avatar-dicebear.spec）；未绑定保持脚本
// 生成的静态字形 ChiefFab（资产文件头 Do not edit，切换发生在消费点）。
// 唯一消费点 = 根 host 的全站 FAB（chief-root.tsx，ADR 0013 D6 单实例）。

import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import type { ChiefContent } from '../fixtures/records.js';
import { ChiefFab } from '../icons/index.js';

export function ChiefFabIcon({ chief }: { chief: ChiefContent }) {
  return chief.agent ? (
    // #444/#950：头像铺满 FAB 圆（字形的内边距不适用于头像面），尺寸由本
    // 槽钉死——Avatar 加载失败退静态资产时盒子不变，无布局跳动。utility
    // 单源在此，五族 FAB（board inline + 四个 wake 壳）同配方。
    <span className="block size-full overflow-hidden rounded-full [&_img]:block [&_img]:size-full [&_img]:object-cover">
      <SeededAvatar
        className="size-full"
        name={chief.agent.displayName}
        src={chief.agent.avatarUrl}
        fallback="/avatar-robot-1.svg"
      />
    </span>
  ) : (
    <ChiefFab />
  );
}
