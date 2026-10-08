// Account route (issue #70, r7 13): avatar head, the setting rows
// (名称 + edit glyph, 语言 select, 推送通知 switch). Copy and row
// order verbatim from the 13 capture.
// #148 (台账 #136 account 行, local-first 裁决同 #129 先例): 删除 / 退出登录
// are SaaS surface a single-user self-host has no semantics for — removed.
// XMON-107 (用户裁决, 同 #148 先例): 邮箱 row removed — pacman 无邮箱账位面
// (单用户 seed 自动登录，无注册/邮件功能)，live 态占位破折号与 fixture 常量
// 均无信息量。
// #306 wontfix 出账（收编 #148 的占位裁定）: 头像更换钮 — the avatar is the
// static /avatar-user.png asset, no upload face exists or will（无
// PATCH /user/me 头像写路径），M7「已渲染的交互必须生效」底线不收死钮，
// 移除不渲染；r7 13 的更换 ink 是 SaaS 头像素残面，avatar 头保留。
// The 推送通知 switch is live — it mirrors Notification.permission and
// clicking an off switch drives the same requestPermission() path as the
// #114 banner (shared useNotificationPermission). Fixture mode freezes the
// switch granted: r7 13 shows it on and the headless chromium
// reports the real API as 'denied'.
// #947 per-face 清零：secondary.css 退役。三处控件的 per-face 皮肤改挂
// token utility（语言触发器 = Button ghost 底座 + 七通道中和，#908
// comment-6001887439 裁决 3）；推送通知开关落 components/ui/Switch 正典
// 默认档（spec/22 §2.5 冻结几何：32×18.4 / thumb 16，track 吃 --input /
// --primary，thumb 吃 --background——旧 29×16 手搓面与 --toggle-knob 消费
// 随之退役；两槽的删槽动作不归本票，§4-2 既有裁定走散件票）。
// `account-card` / `account-avatar` 别名保留 = profile-card 共享模板家族的
// e2e 锚（profile-card.tsx 头注契约；#952 起模板几何住件上 PROFILE_* utility
// 常量，profile-card.css 已退役）；其余类名别名按 #910 裁定 1 退役，载体 =
// role/text。
//
// #74: the 语言 row is live — it reads/writes the workspace locale
// (zh-CN authoritative + en, 01 S6) through the i18n provider and persists
// to the r2 §1.5 dual keys. The dropdown open state is [设计]: the official
// option set was never observed (r2 §11 Q19), so the shape follows the
// plan-dropdown family and lists the two locales as endonyms.

import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSession } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { useNotificationPermission } from '../board/notify-banner.js';
import {
  PROFILE_ROW_NAME_CLS,
  PROFILE_ROW_TALL_CLS,
  ProfileAvatar,
  ProfileCard,
  ProfileHead,
  ProfileRow,
} from '../components/profile-card.js';
import { Button } from '../components/ui/button.js';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { Switch } from '../components/ui/switch.js';
import { USER_NAME } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { LOCALE_NAMES, LOCALES } from '../i18n/locale.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronDown, SquarePen } from '../icons/index.js';
import { SecondaryShell } from '../secondary/shell.js';

/** 语言触发器（Button ghost 底座）：30px 带框盒形（r7 13 实测 box
 *  x1120..1207，高是阶梯外一次性值 §3.1(a)）、12px 字、方角、surface 底 +
 *  border-default 描边；chevron tertiary 墨 12px（走属性，件基类
 *  [&_svg]:size-4 会盖过属性，故就地顶回同链 size-3）。件配方按七通道律
 *  归零到带框皮肤：hover/aria-expanded 回 surface 底 + primary 墨（原形
 *  无 hover、开态无换装），含 dark: 变体。 */
const LANG_TRIGGER_CLS =
  "h-[30px] cursor-pointer gap-1.5 rounded-none border border-(--border) bg-(--card) px-2.5 text-xs font-normal leading-[inherit] text-(--foreground) hover:bg-(--card) hover:text-(--foreground) dark:hover:bg-(--card) aria-expanded:bg-(--card) aria-expanded:text-(--foreground) active:not-aria-[haspopup]:translate-y-0 [&_svg]:text-(--text-tertiary) [&_svg:not([class*='size-'])]:size-3";

/** 语言盘 layout 槽（#1008：V2 弹层壳皮肤 / 描边 Arrow / 冻结锚距退役，
 *  皮肤归 PopoverContent 默认，定位归 Positioner 参数 side=bottom align=end
 *  sideOffset=8）：最小宽 220 是内容 layout；行距归零（旧面行带紧贴）。 */
const LANG_MENU_CLS = 'w-auto min-w-[220px] gap-0';

/** 语言盘选项行（Button ghost 底座）：32px 行 / 8px 圆角 / 12px 字
 *  （壳垫 12px 后行内横缩 4，字墨 inset 落 16）。原形无 hover 态，件配方
 *  按七通道律归零到透明。 */
const LANG_ROW_CLS =
  "h-8 w-full cursor-pointer justify-start gap-0 rounded-[8px] border-0 px-1 text-left text-xs leading-4 font-normal text-(--foreground) hover:bg-transparent hover:text-(--foreground) dark:hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-(--foreground) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-3.5";

export function AccountPage() {
  const { locale, setLocale, t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const [langOpen, setLangOpen] = useState(fixture.ui?.langDropdownOpen === true);
  // M5 live：名称 = GET /api/user/me（seed 单用户 displayName，02 §2.1）。
  // 邮箱行已删（XMON-107 用户裁决）：无邮箱账位面，占位无信息量。
  const { live } = useLiveData();
  const sessionQ = useSession(live);
  const userName = live ? (sessionQ.data?.displayName ?? USER_NAME) : USER_NAME;
  // #148: the switch mirrors the real permission (live); fixture freezes
  // granted so the r7 13 baseline row keeps its on-state knob.
  const { permission, request } = useNotificationPermission(live ? null : 'granted');
  const notifyOn = permission === 'granted';
  return (
    <SecondaryShell route="account" fixture={fixture} sidebarSelected="team" title={t('帐号')}>
      {/* XMON-117：卡盒 / 头像头 / 行 / label / 值槽落 components/profile-card
          的模板件（本页正是模板的来源面）；`account-*` 类名原样留作 e2e
          定位锚（profile-card 家族契约），几何正本住件上 PROFILE_* 常量。
          卡的上边距是页面节奏（card top y60 = 头 44 + 16），归消费点，
          #947 起以 mt-4 utility 承载（原 secondary.css .account-card 规则）。 */}
      <ProfileCard className="account-card mt-4">
        <ProfileHead>
          <ProfileAvatar className="account-avatar">
            {/* XMON-105: the account head is the same identity avatar as the
                sidebar chip / chat user rows (seeded, avatarUrl override),
                not a per-surface static asset. */}
            <SeededAvatar
              className="size-16"
              name={userName}
              src={sessionQ.data?.avatarUrl ?? null}
              fallback="/avatar-user.png"
            />
          </ProfileAvatar>
        </ProfileHead>
        <ProfileRow className={PROFILE_ROW_NAME_CLS} label={t('名称')}>
          {userName}
          <SquarePen width={14} height={14} />
        </ProfileRow>
        <ProfileRow className={PROFILE_ROW_TALL_CLS} label={t('语言')}>
          <span className="relative flex">
            {/* #1008（#983 判决：floating-shell 族拆退役，锚定 absolute 族 →
                registry Popover）：触发钮 = PopoverTrigger（toggle /
                aria-expanded 归原语）；#666 键盘契约保留——initialFocus=
                false 焦点留触发位，同一个键再按一次关面。定位从 wrap
                container + absolute CSS 迁 Positioner 参数（side=bottom
                align=end sideOffset=8 = 原「右缘对齐、顶部锚距 8」）。外点
                关走 Base UI 原生 outside-press（ClickCatcher 退役，穿透
                与否 = #983 遗留待原型实审裁决项）。listbox 语义照旧手挂
                （选项行是 Button role=option，非 Base UI Menu 件）。 */}
            <Popover open={langOpen} onOpenChange={setLangOpen}>
              <PopoverTrigger
                render={
                  <Button variant="ghost" className={LANG_TRIGGER_CLS} aria-haspopup="listbox" />
                }
              >
                {LOCALE_NAMES[locale]}
                <ChevronDown width={12} height={12} />
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="end"
                sideOffset={8}
                initialFocus={false}
                role="listbox"
                aria-label={t('语言')}
                className={LANG_MENU_CLS}
              >
                {LOCALES.map((code) => (
                  <Button
                    key={code}
                    variant="ghost"
                    className={LANG_ROW_CLS}
                    role="option"
                    aria-selected={code === locale}
                    onClick={() => {
                      setLocale(code);
                      setLangOpen(false);
                    }}
                  >
                    {LOCALE_NAMES[code]}
                    {code === locale && (
                      <span className="ml-auto flex text-(--card-button)">
                        <Check width={14} height={14} />
                      </span>
                    )}
                  </Button>
                ))}
              </PopoverContent>
            </Popover>
          </span>
        </ProfileRow>
        <ProfileRow label={t('推送通知')}>
          {/* #947：Switch 正典默认档（spec/22 §2.5 冻结几何），role=switch 与
              aria-checked 由底座透出，e2e 载体 = getByRole('switch')。皮肤
              不再 per-face：track --input（off）/--primary（on），thumb
              --background——§4-1 记的亮模 thumb 1.52:1 是正典已知打磨项
              （状态可辨由 track 翻转 11.03:1 满足，WCAG 1.4.11），处置权在
              视觉方向票，本票不加描边/投影。 */}
          <Switch
            aria-label={t('推送通知')}
            checked={notifyOn}
            onCheckedChange={(checked) => {
              // one-way affordance: the OS permission cannot be revoked from
              // the page, so a granted switch has no click behavior; an off
              // switch drives the #114 banner's requestPermission() path.
              if (checked) request();
            }}
          />
        </ProfileRow>
      </ProfileCard>
    </SecondaryShell>
  );
}
