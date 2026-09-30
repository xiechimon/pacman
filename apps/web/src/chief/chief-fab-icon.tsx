// FAB icon (#444): 绑定 Agent 时图标 = 该 Agent 的头像，走 Avatar 原语的
// 既有语义（avatarUrl 覆盖优先于 dicebear 生成，加载失败 onError 退静态
// 资产，不破图不跳版——原语面钉在 avatar-dicebear.spec）；未绑定保持脚本
// 生成的静态字形 ChiefFab（资产文件头 Do not edit，切换发生在消费点）。
// board 路由的 inline 按钮与 ChiefWake 共用本组件，保证两个消费点同步。

import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import type { ChiefContent } from '../fixtures/records.js';
import { ChiefFab } from '../icons/index.js';

export function ChiefFabIcon({ chief }: { chief: ChiefContent }) {
  return chief.agent ? (
    <span className="fab-avatar">
      <SeededAvatar
        name={chief.agent.displayName}
        src={chief.agent.avatarUrl}
        fallback="/avatar-robot-1.svg"
      />
    </span>
  ) : (
    <ChiefFab />
  );
}
