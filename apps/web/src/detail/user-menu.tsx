// User-menu popover as the r7 17 / 16d captures include it (224-wide @ x8,
// r7 §3.5): identity head, 外观 row with the theme segmented control, then
// the item list — since #163 three real-navigation rows (帐号 / API 密钥 /
// MCP) instead of the frozen plain-text list (r7 §4.1.4). The 外观 row is
// live (#122): each segment drives applyTheme, so the switch repaints
// via the root .light class and persists under `pacman-theme`. The
// open/close trigger landed with #127 — the sidebar avatar chips (rail +
// expanded) toggle the popover through the anchored-overlay family
// wiring; the capture state still rides the fixture flag. #163: the panel
// is bottom-anchored above the avatar chip (detail.css `.user-menu`) —
// the frozen capture top covered the chip off the 732-tall viewport.

import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { USER_MAIL, USER_NAME } from '../fixtures/fixtures.js';
import { useI18n } from '../i18n/provider.js';
import { applyTheme, type Theme } from '../theme.js';

interface UserMenuProps {
  theme: Theme;
  /** #127 sidebar-trigger render: the fixed variant escapes the 40px
   *  rail's overflow:hidden and stacks above the family click-catcher
   *  (detail.css `.user-menu--floating`); same anchoring law as the
   *  capture-frozen absolute variant (#163). */
  floating?: boolean;
}

// 菜单行接真导航（#163）：有真实路由的行渲染为 SPA Link，载当前 search
// 过跳（#121 Link 全族纪律）。href 用字面量——路由常量散在各页面模块，
// import 会经 shell 家族成环（resources/shell → app-sidebar → sidebar →
// 本文件）；App.tsx 路由表为单源对照。新功能/快捷键 隐去：local-first
// 无 whats-new 页、无快捷键面，死钮无对象即除（反馈 行 #149 同款裁决）。
const ROWS = [
  { label: '帐号', href: '/app/account' },
  { label: 'API 密钥', href: '/app/api-keys' },
  { label: 'MCP', href: '/app/resources/mcp-servers' },
];

export function UserMenu({ theme: initialTheme, floating = false }: UserMenuProps) {
  const { t } = useI18n();
  // Links carry the live query string across hops so the fixture scenario
  // survives client-side navigation (sidebar / todo-card convention).
  const { search } = useLocation();
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
        {ROWS.map(({ label, href }) => (
          <Link key={label} className="user-menu-row" to={{ pathname: href, search }}>
            {t(label)}
          </Link>
        ))}
      </div>
    </div>
  );
}
