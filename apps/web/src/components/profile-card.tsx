// 个人页模板（XMON-117）：一张卡 + 头像头 + 行式字段。正本来源是
// `/app/account`（r7 13 逐像素探测的原件形态），抽出来给 agent 资料页
// 复刻同一套模板用。
//
// 为什么是组合件而不是 registry 原语：这不是通用盒子，是**一种页面排版**——
// label 在哪、值槽怎么对齐、行怎么分隔都是模板的一部分。抽成组件后两页不再
// 各写一遍行结构，几何只住 profile-card.css 一处（域 css unlayered，压
// utility 层）。
//
// 分层（XMON-117 × XMON-104）：卡盒的**皮肤**不在这里实现——ProfileCard 的根
// 元素就是 components/ui/panel.tsx 的 `Panel variant="outlined"`（1px
// --border-default 描边 + --surface 底 + 12px 圆角）。本件只管**排版**：头像头 /
// 行 / label / 值槽的几何。皮肤只住 Panel 一处，改描边或底色不改这里。
//
// 消费点保留自己的别名类（`account-card` / `account-avatar` / `agent-*`）：
// e2e 的定位锚钉在那些名字上（#411 别名优先）。组件不管别名，只管模板。

import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Panel } from './ui/panel.js';
import './profile-card.css';

/** 卡盒：皮肤 = Panel outlined 档（描边 / 底色 / 12px 圆角只住 Panel 一处），
 *  本件只挂模板类与 `overflow: visible`（语言 dropdown 与模型菜单要翻出卡外）。
 *  上边距归消费点（帐号面 r7 13 的 16px 是「头 44 + 16」的页面节奏，资源面的
 *  节奏由 .agent-detail 的 gap 给），本组件不带外边距。 */
export function ProfileCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Panel variant="outlined" className={cn('profile-card', className)}>
      {children}
    </Panel>
  );
}

/** 头像头：120px 居中带，头像贴顶 16px。 */
export function ProfileHead({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('profile-head', className)}>{children}</div>;
}

/** 头像圆（64px）。子件透传而不收 src：agent 面的头像是 SeededAvatar 适配层
 *  （种子 / 兜底 / 失败换图三律都在它那儿），帐号面是静态资产。 */
export function ProfileAvatar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <span className={cn('profile-avatar', className)}>{children}</span>;
}

interface ProfileRowProps {
  /** 左列主文本。 */
  label: string;
  /** 左列副文案（模板外的档：[设计] 说明文字跟着 label 走，不挤值槽）。
   *  给了副文案即走自适应行高（`--auto`）。 */
  hint?: string;
  /** 行盒附加类（per-face 几何 / e2e 别名）。 */
  className?: string;
  /** 左列文本附加类（e2e 别名，如 `.agent-field-label`）。 */
  labelClassName?: string;
  /** 左列副文案附加类（e2e 别名，如 `.agent-perm-hint`）。 */
  hintClassName?: string;
  /** 值槽附加类。 */
  valueClassName?: string;
  children: ReactNode;
}

/** 一行：左 label（可带副文案）+ 右值槽。 */
export function ProfileRow({
  label,
  hint,
  className,
  labelClassName,
  hintClassName,
  valueClassName,
  children,
}: ProfileRowProps) {
  return (
    <div className={cn('profile-row', hint != null && 'profile-row--auto', className)}>
      <span className="profile-label">
        <span className={cn('profile-label-text', labelClassName)}>{label}</span>
        {hint != null && <span className={cn('profile-hint', hintClassName)}>{hint}</span>}
      </span>
      <span className={cn('profile-value', valueClassName)}>{children}</span>
    </div>
  );
}
