// Account route (issue #70, r7 13): avatar head with 更换/删除, the four
// setting rows (名称 + edit glyph, 邮箱, 语言 select, 推送通知 switch)
// and the 退出登录 box. Copy and row order verbatim from the 13 capture.
// #74: the 语言 row is live — it reads/writes the workspace locale
// (zh-CN authoritative + en, 01 S6) through the i18n provider and persists
// to the r2 §1.5 dual keys. The dropdown open state is [设计]: the official
// option set was never observed (r2 §11 Q19), so the shape follows the
// plan-dropdown family and lists the two locales as endonyms.

import { useState } from 'react';
import { useSearchParams } from 'react-router';
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
  return (
    <SecondaryShell route="account" fixture={fixture} sidebarSelected="team" title={t('帐号')}>
      <div className="account-card">
        <div className="account-head">
          <span className="account-avatar">
            <img src="/avatar-user.png" alt="" />
          </span>
          <div className="account-avatar-actions">
            <button type="button" className="account-swap">
              {t('更换')}
            </button>
            <button type="button" className="account-delete">
              {t('删除')}
            </button>
          </div>
        </div>
        <div className="account-row account-row--name">
          <span className="account-label">{t('名称')}</span>
          <span className="account-value">
            {USER_NAME}
            <SquarePen width={14} height={14} />
          </span>
        </div>
        <div className="account-row">
          <span className="account-label">{t('邮箱')}</span>
          <span className="account-value account-value--muted">{USER_MAIL}</span>
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
            aria-checked
            aria-label={t('推送通知')}
          >
            <span className="account-switch-knob" />
          </button>
        </div>
      </div>
      <button type="button" className="account-logout">
        {t('退出登录')}
      </button>
    </SecondaryShell>
  );
}
