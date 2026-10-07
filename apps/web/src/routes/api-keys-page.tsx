// API-keys route (issue #70): the empty state per r2 19 (icon tile +
// canon copy + 新建密钥; the captured 查看文档 link is gone — #307
// wontfix, local-first 无文档站, #149 schedules 同律), and with a created key in the
// fixture the r3 §6 display rules — list row masked `pacman_afe07565…`
// (r3 样例原形前缀 tds_ 随品牌槽切换，#109)
// plus the one-time plaintext block carrying the 02 §8 canon
// 「请立即复制密钥，它仅显示一次。」. Row and one-time block shapes are
// [推断] (no capture: r2 §9-12, r3 §6 图失); mask and copy are observed.
// #947 per-face 清零：secondary.css 退役，空态/明文块/列表行几何改挂 token
// utility（tile 44 = size-11、行高 62 与顶部节奏 41/21/11/22 是阶梯外
// 一次性实测值，§3.1(a)；圆角走 --radius-popover 槽）。按钮全走
// components/ui/Button brand——空态新建 = sm 档（30→28px 吸附控件高阶梯，
// §2.6-1 同款 D2 授权；20px 横垫与 13px 字保留实测），一次性明文块的复制
// = brand/sm。类名别名按 #910 裁定 1 退役，空态容器换 data-testid 二级
// 载体（resource-empty 同款，无 role 纯结构钩）。
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApiKeys, useApiMutations, useTodos } from '../api/hooks.js';
import { mapApiKeys, toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { Button } from '../components/ui/button.js';
import { toastError } from '../components/ui/toaster.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronRight, Key } from '../icons/index.js';
import { SecondaryShell } from '../secondary/shell.js';
import { ApiKeyCreateDialog } from './api-key-create-dialog.js';

export function ApiKeysPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  // M5 live：列表 = GET api-keys（只读掩码，02 §8）；新建 = POST 直发默认
  // 权限位（已建屏无 r3 §6 表单弹窗面——名称/白名单归后票 [设计]），一次性
  // 明文块 = 创建响应 plaintext（仅显示一次 canon）。
  const { live, teamId } = useLiveData();
  const keysQ = useApiKeys(teamId, live);
  const todosQ = useTodos(teamId, live);
  const mutations = useApiMutations(teamId);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  // W4 #287：新建走权限位表单弹窗（不再默认直发）；fixture 面按钮保持无操作。
  const [createOpen, setCreateOpen] = useState(false);
  const keys = live
    ? [
        ...mapApiKeys(keysQ.data ?? []),
        ...(plaintext !== null
          ? [{ id: 'once', name: null, masked: '', gitAccess: false, mcpAccess: false, plaintext }]
          : []),
      ]
    : (fixture.apiKeys?.keys ?? []);
  return (
    <SecondaryShell
      route="api-keys"
      fixture={live ? { ...fixture, todos: (todosQ.data ?? []).map(toDisplayTodo) } : fixture}
      title={t('API 密钥')}
    >
      {keys.length === 0 ? (
        <div data-testid="keys-empty">
          <div className="mt-[41px] flex size-11 items-center justify-center rounded-(--radius-popover) bg-(--secondary) text-(--text-secondary) [&_svg]:size-5">
            <Key />
          </div>
          <h2 className="mt-[21px] text-[15px] font-semibold text-(--foreground)">
            {t('尚无 API 密钥。')}
          </h2>
          <p className="mt-[11px] text-[13px] text-(--text-tertiary)">
            {t('API 密钥用于从命令行接入机器，也让 MCP 客户端能访问你的工作台。')}
          </p>
          <div className="mt-[22px] flex items-center gap-4">
            {/* 差额并项——散写形字重 400、无按下位移；border-0 压掉底座 1px
                透明边（bg-clip-padding 会把实底下裁 padding box，钮面四周
                透出 1px 缝）。 */}
            <Button
              variant="brand"
              size="sm"
              className="cursor-pointer border-0 px-5 text-[13px] leading-4 font-normal active:not-aria-[haspopup]:translate-y-0"
              onClick={live ? () => setCreateOpen(true) : undefined}
            >
              {t('新建密钥')}
            </Button>
            {/* 「查看文档」钮全除（#307 wontfix）：local-first 自托管无文档站
                可链（#149 schedules 同律）——隐去，spec 08 档 4 出账。 */}
          </div>
        </div>
      ) : (
        <>
          {keys
            .filter((key) => key.plaintext != null)
            .map((key) => (
              <div
                key={`once-${key.id}`}
                className="mt-6 flex flex-wrap items-center gap-3 rounded-(--radius-popover) border border-(--border) bg-(--secondary) p-4"
              >
                <code className="font-mono text-[13px] text-(--foreground)">{key.plaintext}</code>
                {/* 差额并项（28 高 / 0 12 内垫 / 12px 字 / 字重 400 是 [推断]
                    面的既有钉回值）：border-0 同上。 */}
                <Button
                  variant="brand"
                  size="sm"
                  className="cursor-pointer border-0 px-3 text-xs leading-[inherit] font-normal active:not-aria-[haspopup]:translate-y-0"
                  onClick={
                    live
                      ? () => void navigator.clipboard?.writeText(key.plaintext ?? '')
                      : undefined
                  }
                >
                  {t('复制')}
                </Button>
                <p className="basis-full text-xs text-(--text-tertiary)">
                  {t('请立即复制密钥，它仅显示一次。')}
                </p>
              </div>
            ))}
          <div className="mt-3 flex flex-col gap-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex h-[62px] items-center gap-3 rounded-(--radius-popover) bg-(--secondary) px-4"
              >
                <span className="flex text-(--text-tertiary)">
                  <Key width={16} height={16} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm text-(--foreground)">{key.name ?? key.masked}</span>
                  {key.name != null && (
                    <span className="font-mono text-xs text-(--text-tertiary)">{key.masked}</span>
                  )}
                </span>
                {/* 箭头墨 --text-dim → --text-tertiary（#947 实测换槽，
                    #908 裁决 2）：dim×surface-secondary 亮模 2.73 低于非文本
                    floor 3.0，tertiary 同对实测 5.98/6.55（行内 icon 同墨）。 */}
                <span className="text-(--text-tertiary)">
                  <ChevronRight width={16} height={16} />
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <ApiKeyCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(body) =>
          mutations.createApiKey.mutate(body, {
            onSuccess: (res) => {
              if (typeof res.plaintext === 'string') setPlaintext(res.plaintext);
            },
            // #638：弹窗提交即自关（dialog submit 律），失败 = 密钥没建上、
            // 明文块也不出现，此前零解释。
            onError: (error) => toastError(t('新建 API 密钥失败，请重试。'), error),
          })
        }
      />
    </SecondaryShell>
  );
}
