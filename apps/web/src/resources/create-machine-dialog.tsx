// 添加机器 dialog (wayfinder #181, #179 裁决落账 = CLI 两步表单; copy
// authority = r2 11b 弹窗 + r3 §1.2 API key 分支): rides DialogShell (#68
// family law — X / Esc / backdrop). 引导语 + 两段带 复制 的命令块(安装
// CLI → `npm install -g @xiechimon/pacman-cli@latest`;在机器上执行 → `pacman start`
// ——包名/命令名走 BRAND 品牌槽,#44);底部「在云服务器上运行?改用 API
// key 注册」disclosure 展开 `pacman start --api-key <key> --team <teamId>`
// (teamId 内嵌 = 02 §5.2 路径二 → POST /api/machine/enroll 端点链,
// routes-machine.ts schema 核实)+「获取 API key →」跳 /app/api-keys
// (#121 Link family: scenario 随跳)。无服务端 mutation——注册由 CLI
// 驱动(enroll/start+poll / enroll),机器上线经 machine_presence SSE
// 回流列表;fixture 面纯展示(命令即真相,无 accept 律提交位)。

import { BRAND } from '@pacman/shared';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { DialogShell } from '../detail/dialog-shell.js';
import { useI18n } from '../i18n/provider.js';

interface CreateMachineDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  onClose: () => void;
  /** 授权文案的团队名插值(live = GET /api/teams;fixture = TEAM_NAME)。 */
  teamName: string;
  /** API key 命令内嵌的团队 id;fixture 无真值 → `<teamId>` 占位。 */
  teamId?: string;
}

export function CreateMachineDialog({ open, onClose, teamName, teamId }: CreateMachineDialogProps) {
  const { t } = useI18n();
  // the 获取 API key link carries the scenario string along so dev/parity
  // fixture selection survives the hop (#121 Link family discipline)
  const { search } = useLocation();
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const installCmd = `npm install -g ${BRAND.cliPackageName}@latest`;
  const startCmd = `${BRAND.cliCommandName} start`;
  const apiKeyCmd = `${BRAND.cliCommandName} start --api-key <key> --team ${teamId ?? '<teamId>'}`;
  return (
    <DialogShell title={t('添加机器')} open={open} onClose={onClose}>
      <div className="dlg-enroll">
        <p className="dlg-enroll-lead">
          {t('有条件时优先使用云主机：笔记本会休眠或断网，云主机常在线，构建更稳定。')}
        </p>
        <p className="dlg-enroll-desc">
          {t(
            '在待接入的机器上执行以下命令。浏览器将打开登录页，授权团队 {team} 后机器即可上线。此后它在后台常驻运行，无需保持终端开启。',
            { team: teamName },
          )}
        </p>
        <span className="dlg-enroll-label">{t('安装 CLI')}</span>
        <div className="dlg-enroll-cmd">
          <code>{installCmd}</code>
          <button
            type="button"
            className="dlg-enroll-copy"
            onClick={() => void navigator.clipboard?.writeText(installCmd)}
          >
            {t('复制')}
          </button>
        </div>
        <span className="dlg-enroll-label">{t('在机器上执行')}</span>
        <div className="dlg-enroll-cmd">
          <code>{startCmd}</code>
          <button
            type="button"
            className="dlg-enroll-copy"
            onClick={() => void navigator.clipboard?.writeText(startCmd)}
          >
            {t('复制')}
          </button>
        </div>
        <button
          type="button"
          className="dlg-enroll-toggle"
          aria-expanded={apiKeyOpen}
          onClick={() => setApiKeyOpen((value) => !value)}
        >
          {t('在云服务器上运行？改用 API key 注册')}
        </button>
        {apiKeyOpen && (
          <div className="dlg-enroll-apikey">
            <div className="dlg-enroll-cmd">
              <code>{apiKeyCmd}</code>
              <button
                type="button"
                className="dlg-enroll-copy"
                onClick={() => void navigator.clipboard?.writeText(apiKeyCmd)}
              >
                {t('复制')}
              </button>
            </div>
            <Link className="dlg-enroll-keylink" to={{ pathname: '/app/api-keys', search }}>
              {t('获取 API key →')}
            </Link>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
