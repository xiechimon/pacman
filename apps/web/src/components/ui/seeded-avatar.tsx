// SeededAvatar 适配层（XMON-14 建；#1003 随 #983 判决弃 contents 根）：
// 仓内 #387 的 dicebear Lorelei 头像语义，落到 components/ui/avatar.tsx
// （registry 件）上。
//
// 为什么是适配层而不是让调用点直接用 registry 三件套：逐点手写
// Root/Image/Fallback 会把同一套种子/兜底逻辑抄 22 遍。Root 是定尺盒——
// 上游的 after: 发丝环需要真实 containing block（contents 根上 absolute
// 伪元素会爬到页级祖先，成为整页点击拦截层，XMON-14 实测；#1003 重拉后
// 环回归源）。几何落点在 Root：消费点显式传 className="size-N"（与各面
// wrapper 的 [&_img]:size-N utility 同值同构，img 由 registry 件的
// size-full 随 Root）。
//
// 三条契约（与迁移前的 apps/web/src/ui/avatar.tsx 逐条等价，e2e
// avatar-dicebear.spec.ts 是正本）：
// 1) src 解析：src 覆盖 > name 种子（encodeURIComponent，同名恒同像）> fallback。
//    name/src 皆空时直接渲染 fallback（如 create-dialog 未输入名称）。
// 2) 加载失败一次性换 fallback，按失败 URL 记账——换名重试，fallback 自身失败
//    不死循环（failed 已为 true，不再换）。
// 3) img 常驻 DOM：Image 走 keepMounted。registry 缺省形态只在 loaded 后才挂
//    img，`.foo img` 的 src/boundingBox 断言会落到 0 元素。
// aria-hidden 由 keepMounted 在未 loaded 时置上（registry 行为）；img 本身
// alt=""，是装饰性内容。

import { useState } from 'react';
import { Avatar, AvatarImage } from './avatar.js';

/** dicebear 生成端（#387）：style=lorelei、9.x。 */
const DICEBEAR_ENDPOINT = 'https://api.dicebear.com/9.x/lorelei/svg?seed=';

export interface SeededAvatarProps {
  /** 种子 —— 面上展示的 displayName；null/'' = 直接渲染 fallback 资产
   *  （如 create-dialog 尚未输入名称时）。 */
  name?: string | null;
  /** 显式 avatarUrl 覆盖；非 null 时压过 dicebear URL。 */
  src?: string | null;
  /** #387 之前的静态资产：name/src 皆空时的首帧，以及加载失败的兜底。 */
  fallback: string;
  /** per-face 别名类/几何类透传。 */
  className?: string;
}

export function SeededAvatar({ name, src, fallback, className }: SeededAvatarProps) {
  // falsy-safe：'' avatarUrl（空串覆盖）视同未设置，落回生成/兜底路径
  const generated = name ? `${DICEBEAR_ENDPOINT}${encodeURIComponent(name)}` : fallback;
  const resolved = src || generated;
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const failed = failedFor === resolved;
  return (
    // Root 定尺盒：几何由消费点 className（size-N）承载，img 走件内 size-full
    <Avatar className={className}>
      <AvatarImage
        keepMounted
        src={failed ? fallback : resolved}
        alt=""
        onLoadingStatusChange={(status) => {
          if (status === 'error' && !failed) setFailedFor(resolved);
        }}
      />
    </Avatar>
  );
}
