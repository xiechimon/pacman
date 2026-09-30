// SeededAvatar 适配层（XMON-14）：仓内 #387 的 dicebear Lorelei 头像语义，
// 落到 components/ui/avatar.tsx（registry 件）上。
//
// 为什么是适配层而不是让调用点直接用 registry 三件套：本仓的尺寸正本在
// per-face 几何规则（`.foo img` / `[&_img]:size-N`），而 registry 的 Avatar
// Root 是一个定尺盒（size-8 + after 环）。逐点手写 Root/Image/Fallback 会把
// 同一套种子/兜底逻辑抄 12 遍，且插进去的盒子会打断百分比链——chief-fab.spec
// 把 FAB 头像钉在 48×48、user-menu-trigger.spec 用 img 的 boundingBox 量锚定
// 间距，都是 img 几何。故本层做两件事：把语义收成一处，Root 走 `contents`
// 让 img 的 containing block 仍是各面的 per-face 容器。
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
    // contents：不生成盒，per-face 容器仍是 img 的 containing block（几何正本）
    <Avatar className={className != null ? `contents ${className}` : 'contents'}>
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
