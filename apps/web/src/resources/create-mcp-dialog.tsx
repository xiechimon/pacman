// 添加 MCP 服务器 dialog (wayfinder #174, r8 71/72 geometry [推断] — the
// capture PNGs are unreadable on this API line, fields follow 02 §6.2 /
// r3 §5.1 text authority): rides DialogShell (#68 family law). Shared
// fields 名称/标识符 (slug, 前缀语义 02 canon) + a 远程 HTTP / 本地命令
// transport segment (dlg-seg precedent, branch-dialog). http form carries
// URL + header rows; stdio carries 命令 + 参数 (whitespace-split args
// [推断]). Live submit = mutations.createMcpServer (POST
// /api/teams/:id/mcp-servers: slug unique 409, http requires url, stdio
// requires command — the gates mirror those server rules); fixture
// follows the accept-dialog 律 (#148: close on submit).

import { useState } from 'react';
import { useI18n } from '../i18n/provider.js';
import { PlusSmall } from '../icons/index.js';
import { DialogShell } from '../ui/dialog-shell.js';
import { Input } from '../ui/input.js';

interface HeaderRow {
  key: string;
  value: string;
}

interface CreateMcpDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  onClose: () => void;
  /** M5 live 面：添加 = POST mcp-servers；缺省 = fixture 律（提交即关）。 */
  onCreate?: (body: {
    label: string;
    slug: string;
    transport: 'http' | 'stdio';
    url?: string;
    command?: string;
    args?: string[];
    headers?: Record<string, string>;
  }) => void;
}

export function CreateMcpDialog({ open, onClose, onCreate }: CreateMcpDialogProps) {
  const { t } = useI18n();
  const [transport, setTransport] = useState<'http' | 'stdio'>('http');
  const [label, setLabel] = useState('');
  const [slug, setSlug] = useState('');
  const [url, setUrl] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [headers, setHeaders] = useState<HeaderRow[]>([{ key: '', value: '' }]);

  const ready =
    label.trim() !== '' &&
    slug.trim() !== '' &&
    (transport === 'http' ? url.trim() !== '' : command.trim() !== '');

  const submit = () => {
    if (!ready) return;
    if (onCreate != null) {
      const headerPairs = Object.fromEntries(
        headers.filter((row) => row.key.trim() !== '').map((row) => [row.key.trim(), row.value]),
      );
      onCreate({
        label: label.trim(),
        slug: slug.trim(),
        transport,
        ...(transport === 'http'
          ? {
              url: url.trim(),
              ...(Object.keys(headerPairs).length > 0 ? { headers: headerPairs } : {}),
            }
          : {
              command: command.trim(),
              ...(args.trim() !== '' ? { args: args.trim().split(/\s+/) } : {}),
            }),
      });
    } else {
      onClose();
    }
    setLabel('');
    setSlug('');
    setUrl('');
    setCommand('');
    setArgs('');
    setHeaders([{ key: '', value: '' }]);
  };

  return (
    <DialogShell
      title={t('添加 MCP 服务器')}
      open={open}
      onClose={onClose}
      footer={
        <div className="dlg-form-foot">
          <button type="button" className="dlg-mcp-create" disabled={!ready} onClick={submit}>
            {t('添加 MCP 服务器')}
          </button>
        </div>
      }
    >
      <div className="dlg-form">
        <div className="dlg-form-seg" role="tablist" aria-label={t('类型')}>
          {(
            [
              ['http', '远程 HTTP'],
              ['stdio', '本地命令'],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={transport === value}
              className="dlg-mcp-seg-tab"
              data-active={transport === value}
              onClick={() => setTransport(value)}
            >
              {t(text)}
            </button>
          ))}
        </div>
        <label className="dlg-form-label" htmlFor="dlg-mcp-label">
          {t('名称')}
        </label>
        <Input
          id="dlg-mcp-label"
          className="dlg-form-input"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={t('例如：内部工单系统')}
        />
        <label className="dlg-form-label" htmlFor="dlg-mcp-slug">
          {t('标识符')}
        </label>
        <Input
          id="dlg-mcp-slug"
          className="dlg-form-input"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="internal-api"
        />
        <div className="dlg-form-note">{t('用作前缀，创建后不可修改。')}</div>
        {transport === 'http' ? (
          <>
            <label className="dlg-form-label" htmlFor="dlg-mcp-url">
              URL
            </label>
            <Input
              id="dlg-mcp-url"
              className="dlg-form-input"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://mcp.example.com/sse"
            />
            <div className="dlg-form-label">{t('请求头（可选）')}</div>
            {headers.map((row, i) => (
              <div className="dlg-mcp-header-row" key={i}>
                <Input
                  className="dlg-form-input"
                  aria-label={t('请求头名称')}
                  value={row.key}
                  placeholder="Authorization"
                  onChange={(event) =>
                    setHeaders((rows) =>
                      rows.map((r, j) => (i === j ? { ...r, key: event.target.value } : r)),
                    )
                  }
                />
                <Input
                  className="dlg-form-input"
                  aria-label={t('请求头值')}
                  value={row.value}
                  placeholder="Bearer …"
                  onChange={(event) =>
                    setHeaders((rows) =>
                      rows.map((r, j) => (i === j ? { ...r, value: event.target.value } : r)),
                    )
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className="dlg-mcp-header-add"
              onClick={() => setHeaders((rows) => [...rows, { key: '', value: '' }])}
            >
              <PlusSmall width={12} height={12} />
              {t('添加请求头')}
            </button>
          </>
        ) : (
          <>
            <label className="dlg-form-label" htmlFor="dlg-mcp-command">
              {t('命令')}
            </label>
            <Input
              id="dlg-mcp-command"
              className="dlg-form-input"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="npx -y mcp-server-fs"
            />
            <label className="dlg-form-label" htmlFor="dlg-mcp-args">
              {t('参数（可选，空格分隔）')}
            </label>
            <Input
              id="dlg-mcp-args"
              className="dlg-form-input"
              value={args}
              onChange={(event) => setArgs(event.target.value)}
              placeholder="/data --verbose"
            />
          </>
        )}
      </div>
    </DialogShell>
  );
}
