// Account route (issue #70, r7 13): avatar head with 更换/删除, the four
// setting rows (名称 + edit glyph, 邮箱, 语言 select, 推送通知 switch)
// and the 退出登录 box. Static surface — the edit flows land with the
// overlay tickets; copy and row order verbatim from the 13 capture.
import { useSearchParams } from 'react-router';
import { USER_MAIL, USER_NAME } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { ChevronDown, SquarePen } from '../icons/index.js';
import { SecondaryShell } from '../secondary/shell.js';

export function AccountPage() {
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  return (
    <SecondaryShell route="account" fixture={fixture} sidebarSelected="team" title="帐号">
      <div className="account-card">
        <div className="account-head">
          <span className="account-avatar">
            <img src="/avatar-user.png" alt="" />
          </span>
          <div className="account-avatar-actions">
            <button type="button" className="account-swap">
              更换
            </button>
            <button type="button" className="account-delete">
              删除
            </button>
          </div>
        </div>
        <div className="account-row account-row--name">
          <span className="account-label">名称</span>
          <span className="account-value">
            {USER_NAME}
            <SquarePen width={14} height={14} />
          </span>
        </div>
        <div className="account-row">
          <span className="account-label">邮箱</span>
          <span className="account-value account-value--muted">{USER_MAIL}</span>
        </div>
        <div className="account-row account-row--tall">
          <span className="account-label">语言</span>
          <button type="button" className="account-select">
            简体中文
            <ChevronDown width={12} height={12} />
          </button>
        </div>
        <div className="account-row">
          <span className="account-label">推送通知</span>
          <button
            type="button"
            className="account-switch"
            role="switch"
            aria-checked
            aria-label="推送通知"
          >
            <span className="account-switch-knob" />
          </button>
        </div>
      </div>
      <button type="button" className="account-logout">
        退出登录
      </button>
    </SecondaryShell>
  );
}
