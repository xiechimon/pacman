// 个人页模板（XMON-117）：一张卡 + 头像头 + 行式字段。正本来源是
// `/app/account`（r7 13 逐像素探测的原件形态），抽出来给 agent 资料页
// 复刻同一套模板用。
//
// 为什么是组合件而不是 registry 原语：这不是通用盒子，是**一种页面排版**——
// label 在哪、值槽怎么对齐、行怎么分隔都是模板的一部分。抽成组件后两页不再
// 各写一遍行结构。
//
// 分层（XMON-117 × XMON-104）：卡盒的**皮肤**不在这里实现——ProfileCard 的根
// 元素就是 components/ui/card.tsx 的 registry `Card`（#983 判决：panel→Card，
// #1005 执行——rounded-xl / ring-1 / bg-card 官方默认皮肤）。本件只管**排版**：
// 头像头 / 行 / label / 值槽的几何。皮肤只住 Card 一处。
//
// #952（profile-card.css 退役，spec/22 §3.1）：模板几何全部改件上 token
// utility，单源在本文件的 PROFILE_* 常量。行高逐值沿用 r7 13 的探测
// （41 = 40 内高 + 1px 分隔线；名称行 49、语言行 57）；带副
// 文案的行走 auto 档（高度由内容撑开，上下各 8px 内垫，label 列封顶 60%）。
// 模板类名（profile-card/head/avatar/row/label/label-text/hint/value）原样
// 输出——components 自有件类是 e2e 直取载体（#944 provider 面判例，
// checkbox-unified.spec 头注同律）；消费点保留自己的别名类（`account-card` /
// `agent-*`）。
//
// 消费点档差走导出常量（h-[49px] 名称行 / h-[57px] 语言行 / 值槽 grow·editor
// 档），raw div 行（不走 ProfileRow 的记忆行等）用 PROFILE_ROW_AUTO_CLS 取
// 同一份行盒配方——不再有两套行几何。

import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Card } from './ui/card.js';

/** 卡盒：overflow visible 保留——agent 资料页的模型菜单仍走 FloatingShell
 *  卡内锚定（select.tsx 退役 = #1010，波 2；Popover 化后随件摘除，语言
 *  dropdown 已 Portal 化不受裁切影响）。首末子件逻辑角 = 卡圆角 − 1px 环
 *  （rounded-xl = --radius-xl；ring 是 box-shadow 不占位。逻辑角而非
 *  rounded-t/b 简写：单行卡的首末是同一个元素，简写会互相覆盖）。 */
const PROFILE_CARD_CLS =
  'profile-card overflow-visible [&>:first-child]:rounded-ss-[calc(var(--radius-xl)-1px)] [&>:first-child]:rounded-se-[calc(var(--radius-xl)-1px)] [&>:last-child]:rounded-es-[calc(var(--radius-xl)-1px)] [&>:last-child]:rounded-ee-[calc(var(--radius-xl)-1px)]';

/** 行盒基底（原 .profile-row）：41 = 40 内高 + 1px 分隔线（r7 13 行界）。
 *  行自带的 border-top 是行间分隔线；做首件时上方没有行可分，那条线只会与卡
 *  的描边叠成 2px、且是直线不吃圆角——first: 档摘掉。 */
const PROFILE_ROW_CLS =
  'profile-row flex h-[41px] items-center justify-between gap-4 border-t border-(--border) bg-(--secondary) px-4 first:border-t-0';

/** 带副文案的行（原 .profile-row--auto）：高度随内容（label 列两行时行自然
 *  变高），上下 8px 内垫保住行与行的呼吸，与固定档的 41/49/57 同一节奏。
 *  raw div 消费面（agent 记忆行 / 权限空态行）与 ProfileRow 的 hint 档共用
 *  本配方。 */
export const PROFILE_ROW_AUTO_CLS =
  'profile-row flex h-auto min-h-[41px] items-center justify-between gap-4 border-t border-(--border) bg-(--secondary) px-4 py-2 first:border-t-0';

/** 名称行档（原 .profile-row--name，r7 13 探测 49）。 */
export const PROFILE_ROW_NAME_CLS = 'h-[49px]';

/** 语言行档（原 .profile-row--tall，r7 13 探测 57）。 */
export const PROFILE_ROW_TALL_CLS = 'h-[57px]';

/** 副文案律（原 .profile-hint）：12px 三级色、1.5 行高。 */
export const PROFILE_HINT_CLS = 'profile-hint text-[12px] leading-[1.5] text-(--text-tertiary)';

/** 值槽吃余量（原 .profile-value--grow）：行内编辑（名称输入框 / 职责
 *  textarea）与长值时用。 */
export const PROFILE_VALUE_GROW_CLS = 'min-w-0 flex-[1_1_auto]';

/** 编辑器形态（原 .profile-value--editor）：值槽转列（输入框在上、动作行在
 *  下），纵向撑满。 */
export const PROFILE_VALUE_EDITOR_CLS = 'min-w-0 flex-[1_1_auto] flex-col items-stretch gap-2';

/** 卡盒：皮肤 = registry Card 默认档（rounded-xl / ring-1 / bg-card，#983
 *  panel→Card 判决），本件只挂 overflow 与首末子件圆角；件默认纵向垫/gap
 *  归零（行满幅贴边，layout）。上边距归消费点（帐号面 r7 13 的 16px 是
 *  「头 44 + 16」的页面节奏，资源面的节奏由域配方给），本组件不带外边距。 */
export function ProfileCard({ className, children }: { className?: string; children: ReactNode }) {
  return <Card className={cn(PROFILE_CARD_CLS, 'gap-0 py-0', className)}>{children}</Card>;
}

/** 头像头（原 .profile-head）：120px 居中带，头像贴顶 16px（头像圆
 *  y77..141）；底色与 Card 同槽（bg-card），顶圆角随卡盒逻辑角配方。 */
export function ProfileHead({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'profile-head flex h-[120px] flex-col items-center rounded-t-[calc(var(--radius-xl)-1px)] pt-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** 头像圆（原 .profile-avatar，64px）。子件透传而不收 src：agent 面的头像是
 *  SeededAvatar 适配层（种子 / 兜底 / 失败换图三律都在它那儿），帐号面是静态
 *  资产。 */
export function ProfileAvatar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'profile-avatar size-16 overflow-hidden rounded-full bg-(--card) [&_img]:block [&_img]:size-16',
        className,
      )}
    >
      {children}
    </span>
  );
}

interface ProfileRowProps {
  /** 左列主文本。 */
  label: string;
  /** 左列副文案（模板外的档：[设计] 说明文字跟着 label 走，不挤值槽）。
   *  给了副文案即走自适应行高（auto 档）。 */
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

/** 一行：左 label（可带副文案）+ 右值槽。auto 档（给了 hint）下 label 列
 *  封顶 60%（原 .profile-row--auto 两列律）：副文案是整句话（职责/权限六档
 *  的说明），不封顶会把值槽挤到贴边；封顶后长句在列内折行。 */
export function ProfileRow({
  label,
  hint,
  className,
  labelClassName,
  hintClassName,
  valueClassName,
  children,
}: ProfileRowProps) {
  const auto = hint != null;
  return (
    <div className={cn(PROFILE_ROW_CLS, auto && 'h-auto min-h-[41px] py-2', className)}>
      <span
        className={cn(
          'profile-label flex flex-col gap-0.5',
          auto && 'max-w-[60%] min-w-0 flex-[1_1_auto]',
        )}
      >
        <span
          className={cn('profile-label-text text-[13px] text-(--text-secondary)', labelClassName)}
        >
          {label}
        </span>
        {auto && <span className={cn(PROFILE_HINT_CLS, hintClassName)}>{hint}</span>}
      </span>
      <span
        className={cn(
          'profile-value flex items-center gap-3.5 text-[14px] text-(--foreground) [&_svg]:text-(--text-tertiary)',
          auto && 'flex-none',
          valueClassName,
        )}
      >
        {children}
      </span>
    </div>
  );
}
