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
// XMON-107 (用户裁决): the capture's head mail line is removed — pacman
// 无邮箱账位面（单用户 seed 自动登录），live 态曾渲染 fixture 常量地址。

import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useLiveData } from '../api/provider.js';
import { Button } from '../components/ui/button.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { useI18n } from '../i18n/provider.js';
import { applyTheme, type Theme } from '../theme.js';

interface UserMenuProps {
  theme: Theme;
  /** #127 sidebar-trigger render: the fixed variant escapes the 40px
   *  rail's overflow:hidden and stacks above the family click-catcher
   *  (detail.css `.user-menu--floating`); same anchoring law as the
   *  capture-frozen absolute variant (#163). */
  floating?: boolean;
  /** #656: 进出场工具类落位面（动画必须挂在定位面板本体上——挂在祖先
   *  会经 keyframe transform 拽走 fixed 子级的 containing block）。 */
  className?: string;
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

export function UserMenu({ theme: initialTheme, floating = false, className }: UserMenuProps) {
  const { t } = useI18n();
  const { user } = useLiveData();
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
    <div
      className={`user-menu${floating ? ' user-menu--floating' : ''}${
        className != null && className !== '' ? ` ${className}` : ''
      }`}
    >
      <div className="user-menu-head">
        <SeededAvatar name={user.displayName} src={user.avatarUrl} fallback="/avatar-user.png" />
        <div>
          <div className="user-menu-name">{user.displayName}</div>
        </div>
      </div>
      <div className="user-menu-rows">
        <div className="user-menu-row">
          {t('外观')}
          <span className="user-menu-seg">
            {/* XMON-24：分段钮切 shadcn ghost——皮肤全在 detail.css
                `.user-menu-seg button` 后代选择器 per-face（元素仍是
                button，选择器照旧命中；data-active 直通）；utilities 只清
                font-medium 与 active 位移两条底座差额。 */}
            <Button
              variant="ghost"
              className="font-normal active:not-aria-[haspopup]:translate-y-0"
              data-active={theme === 'light'}
              onClick={() => select('light')}
            >
              {t('浅色')}
            </Button>
            <Button
              variant="ghost"
              className="font-normal active:not-aria-[haspopup]:translate-y-0"
              data-active={theme === 'dark'}
              onClick={() => select('dark')}
            >
              {t('深色')}
            </Button>
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
