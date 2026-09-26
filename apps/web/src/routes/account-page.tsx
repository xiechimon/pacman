// Account route (issue #70, r7 13): avatar head with 更换, the four
// setting rows (名称 + edit glyph, 邮箱, 语言 select, 推送通知 switch).
// Copy and row order verbatim from the 13 capture.
// #148 (台账 #136 account 行, local-first 裁决同 #129 先例): 删除 / 退出登录
// are SaaS surface a single-user self-host has no semantics for — removed;
// 更换头像 stays a wontfix placeholder (the avatar is the static
// /avatar-user.png asset, no upload face exists or will); the 推送通知
// switch is live — it mirrors Notification.permission and clicking an off
// switch drives the same requestPermission() path as the #114 banner
// (shared useNotificationPermission). Fixture mode freezes the switch
// granted: r7 13 shows it on and the parity headless chromium reports the
// real API as 'denied'.
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
import { USER_MAIL, USER_NAME } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { LOCALE_NAMES, LOCALES } from '../i18n/locale.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronDown, SquarePen } from '../icons/index.js';
import { ClickCatcher, useEscapeClose } from '../overlays/dismiss.js';
import { SecondaryShell } from '../secondary/shell.js';
import { Button } from '../ui/button.js';

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
            <img src="/avatar-user.png" alt="" />
          </span>
          <div className="account-avatar-actions">
            {/* wontfix (台账 #136 account 行, #148 裁决): local single user —
                the avatar is the static placeholder asset, no upload face
                exists or will; the 更换 ink stays as capture-verbatim chrome.
                a3-pages 收编：Button text 档逐值同形（indigo 13px 无框）。 */}
            <Button variant="text" className="account-swap">
              {t('更换')}
            </Button>
          </div>
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
            <button
              type="button"
              className="account-select"
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              onClick={() => setLangOpen((value) => !value)}
            >
              {LOCALE_NAMES[locale]}
              <ChevronDown width={12} height={12} />
            </button>
            {langOpen && (
              <>
                <ClickCatcher onClose={() => setLangOpen(false)} />
                <div className="lang-dropdown" role="listbox" aria-label={t('语言')}>
                  {LOCALES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      className="lang-dropdown-row"
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
                    </button>
                  ))}
                </div>
              </>
            )}
          </span>
        </div>
        <div className="account-row">
          <span className="account-label">{t('推送通知')}</span>
          <button
            type="button"
            className="account-switch"
            role="switch"
            aria-checked={notifyOn}
            aria-label={t('推送通知')}
            onClick={() => {
              // one-way affordance: the OS permission cannot be revoked from
              // the page, so a granted switch has no click behavior; an off
              // switch drives the #114 banner's requestPermission() path.
              if (!notifyOn) request();
            }}
          >
            <span className="account-switch-knob" />
          </button>
        </div>
      </div>
    </SecondaryShell>
  );
}
