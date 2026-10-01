// Account route (issue #70, r7 13): avatar head, the four setting rows
// (名称 + edit glyph, 邮箱, 语言 select, 推送通知 switch). Copy and row
// order verbatim from the 13 capture.
// #148 (台账 #136 account 行, local-first 裁决同 #129 先例): 删除 / 退出登录
// are SaaS surface a single-user self-host has no semantics for — removed.
// #306 wontfix 出账（收编 #148 的占位裁定）: 头像更换钮 — the avatar is the
// static /avatar-user.png asset, no upload face exists or will（无
// PATCH /user/me 头像写路径），M7「已渲染的交互必须生效」底线不收死钮，
// 移除不渲染；r7 13 的更换 ink 是 SaaS 头像素残面，avatar 头保留。
// The 推送通知 switch is live — it mirrors Notification.permission and
// clicking an off switch drives the same requestPermission() path as the
// #114 banner (shared useNotificationPermission). Fixture mode freezes the
// switch granted: r7 13 shows it on and the headless chromium
// reports the real API as 'denied'.
// B2 · secondary 面（XMON-20）：页内三处控件（语言触发器、语言选项行、推送通知
// 开关）全部走 components/ui 件——前两者 Button ghost 档，开关走 Switch。类名
// alias 原样留作 e2e 定位锚（#411 别名优先），per-face 几何仍住 secondary.css。
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
import { Button } from '../components/ui/button.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { Switch } from '../components/ui/switch.js';
import { USER_MAIL, USER_NAME } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { LOCALE_NAMES, LOCALES } from '../i18n/locale.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronDown, SquarePen } from '../icons/index.js';
import { ClickCatcher, useEscapeClose } from '../overlays/dismiss.js';
import { SecondaryShell } from '../secondary/shell.js';

export function AccountPage() {
  const { locale, setLocale, t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const [langOpen, setLangOpen] = useState(fixture.ui?.langDropdownOpen === true);
  useEscapeClose(langOpen, () => setLangOpen(false));
  // M5 live：名称 = GET /api/user/me（seed 单用户 displayName，02 §2.1）；
  // 邮箱 = 复刻无邮箱账位面（自动登录，无注册）——占位破折号 [设计]。
  const { live } = useLiveData();
  const sessionQ = useSession(live);
  const userName = live ? (sessionQ.data?.displayName ?? USER_NAME) : USER_NAME;
  const userEmail = live ? '—' : USER_MAIL;
  // #148: the switch mirrors the real permission (live); fixture freezes
  // granted so the r7 13 baseline row keeps its on-state knob.
  const { permission, request } = useNotificationPermission(live ? null : 'granted');
  const notifyOn = permission === 'granted';
  return (
    <SecondaryShell route="account" fixture={fixture} sidebarSelected="team" title={t('帐号')}>
      <div className="account-card">
        <div className="account-head">
          <span className="account-avatar">
            {/* XMON-105: the account head is the same identity avatar as the
                sidebar chip / chat user rows (seeded, avatarUrl override),
                not a per-surface static asset. */}
            <SeededAvatar
              name={userName}
              src={sessionQ.data?.avatarUrl ?? null}
              fallback="/avatar-user.png"
            />
          </span>
        </div>
        <div className="account-row account-row--name">
          <span className="account-label">{t('名称')}</span>
          <span className="account-value">
            {userName}
            <SquarePen width={14} height={14} />
          </span>
        </div>
        <div className="account-row">
          <span className="account-label">{t('邮箱')}</span>
          <span className="account-value account-value--muted">{userEmail}</span>
        </div>
        <div className="account-row account-row--tall">
          <span className="account-label">{t('语言')}</span>
          <span className="account-select-wrap">
            {/* B2 · secondary 面（XMON-20）：底座 = components/ui/Button，per-face
                几何仍住 secondary.css 的 .account-select。差额并项——散写形字重
                400（底座 font-medium）；chevron 走 width/height 属性 12px，底座
                的 [&_svg]:size-4 会盖过属性，故就地顶回同一链的 size-3。
                aria-haspopup 在位 = 底座的 active:translate-y-px 本就不触发。 */}
            <Button
              variant="ghost"
              className="account-select font-normal leading-[inherit] [&_svg:not([class*='size-'])]:size-3"
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              onClick={() => setLangOpen((value) => !value)}
            >
              {LOCALE_NAMES[locale]}
              <ChevronDown width={12} height={12} />
            </Button>
            {langOpen && (
              <>
                <ClickCatcher onClose={() => setLangOpen(false)} />
                <div className="lang-dropdown" role="listbox" aria-label={t('语言')}>
                  {LOCALES.map((code) => (
                    <Button
                      key={code}
                      variant="ghost"
                      className="lang-dropdown-row justify-start gap-0 text-left font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-3.5"
                      role="option"
                      aria-selected={code === locale}
                      onClick={() => {
                        setLocale(code);
                        setLangOpen(false);
                      }}
                    >
                      {LOCALE_NAMES[code]}
                      {code === locale && (
                        <span className="lang-dropdown-check">
                          <Check width={14} height={14} />
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </span>
        </div>
        <div className="account-row">
          <span className="account-label">{t('推送通知')}</span>
          {/* B2 · secondary 面（XMON-20）：底座 = components/ui/Switch（role/aria-checked
              由底座透出，per-face 几何仍住 secondary.css 的 .account-switch*）。
              差额并项走 thumbClassName——底座默认的 checked 位移会与域 css 的
              left/right 定位叠加成双重位移（switch.tsx 记的那处仓内偏离口）。 */}
          <Switch
            className="account-switch"
            thumbClassName="account-switch-knob group-data-[size=default]/switch:data-checked:translate-x-0"
            aria-label={t('推送通知')}
            checked={notifyOn}
            onCheckedChange={(checked) => {
              // one-way affordance: the OS permission cannot be revoked from
              // the page, so a granted switch has no click behavior; an off
              // switch drives the #114 banner's requestPermission() path.
              if (checked) request();
            }}
          />
        </div>
      </div>
    </SecondaryShell>
  );
}
