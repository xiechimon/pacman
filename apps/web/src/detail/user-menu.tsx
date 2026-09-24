// User-menu popover as the r7 17 / 16d captures include it (224-wide @
// 8,410, r7 §3.5; 244 high since #149 dropped the 反馈 row — 272 − 28):
// identity head, 外观 row with the theme segmented
// control, then the plain-text item list (r7 §4.1.4). The 外观 row is
// live (#122): each segment drives applyTheme, so the switch repaints
// via the root .light class and persists under `pacman-theme`. The
// open/close trigger landed with #127 — the sidebar avatar chips (rail +
// expanded) toggle the popover through the anchored-overlay family
// wiring; the capture state still rides the fixture flag.

import { useState } from 'react';
import { USER_MAIL, USER_NAME } from '../fixtures/fixtures.js';
import { useI18n } from '../i18n/provider.js';
import { applyTheme, type Theme } from '../theme.js';

interface UserMenuProps {
  theme: Theme;
  /** #127 sidebar-trigger render: the fixed variant escapes the 40px
   *  rail's overflow:hidden and stacks above the family click-catcher
   *  (detail.css `.user-menu--floating`); same (8,410) capture geometry. */
  floating?: boolean;
}

// 反馈 行随 feedback 页整页移除（#149 local-first 裁决：SaaS 反馈通道无
// 对象，#129 先例）；「新功能」不指同页，保留。行集短一行，菜单高度随
// content 收缩（r7 §3.5 224×272 几何按 #149 修订）。
const ROWS = ['帐号', 'API 密钥', 'MCP', '新功能', '快捷键'];

export function UserMenu({ theme: initialTheme, floating = false }: UserMenuProps) {
  const { t } = useI18n();
  // the popover mounts per open state; the stored theme at mount is the
  // segment's initial value and applyTheme keeps storage the source of
  // truth across reloads
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const select = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
  };
  return (
    <div className={floating ? 'user-menu user-menu--floating' : 'user-menu'}>
      <div className="user-menu-head">
        <img src="/avatar-user.png" alt="" />
        <div>
          <div className="user-menu-name">{USER_NAME}</div>
          <div className="user-menu-mail">{USER_MAIL}</div>
        </div>
      </div>
      <div className="user-menu-rows">
        <div className="user-menu-row">
          {t('外观')}
          <span className="user-menu-seg">
            <button type="button" data-active={theme === 'light'} onClick={() => select('light')}>
              {t('浅色')}
            </button>
            <button type="button" data-active={theme === 'dark'} onClick={() => select('dark')}>
              {t('深色')}
            </button>
          </span>
        </div>
        {ROWS.map((row) => (
          <div key={row} className="user-menu-row">
            {t(row)}
          </div>
        ))}
      </div>
    </div>
  );
}
