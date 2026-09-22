// User-menu popover as the r7 17 / 16d captures include it (224×272 @
// 8,410, r7 §3.5): identity head, 外观 row with the theme segmented
// control, then the plain-text item list (r7 §4.1.4). Static render — the
// interactive menu lands with the overlay ticket.

import { USER_MAIL, USER_NAME } from '../fixtures/fixtures.js';

interface UserMenuProps {
  theme: 'light' | 'dark';
}

const ROWS = ['帐号', 'API 密钥', 'MCP', '反馈', '新功能', '快捷键'];

export function UserMenu({ theme }: UserMenuProps) {
  return (
    <div className="user-menu">
      <div className="user-menu-head">
        <img src="/avatar-user.png" alt="" />
        <div>
          <div className="user-menu-name">{USER_NAME}</div>
          <div className="user-menu-mail">{USER_MAIL}</div>
        </div>
      </div>
      <div className="user-menu-rows">
        <div className="user-menu-row">
          外观
          <span className="user-menu-seg">
            <button type="button" data-active={theme === 'light'}>
              浅色
            </button>
            <button type="button" data-active={theme === 'dark'}>
              深色
            </button>
          </span>
        </div>
        {ROWS.map((row) => (
          <div key={row} className="user-menu-row">
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}
