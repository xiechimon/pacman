// 浏览器授权页（W4 #285，02 §5.2 路径一）：enroll/start 返回的 capability
// URL 落地页——?enroll=<id> 到达 → poll 轮询（pending = 待授权卡 + 确认钮；
// authorized = 完成态；expired = 失效文案）→ confirm 建机（无 apiKey，capability
// 单次）。无参到达 = 本页自起 start（拿 enrollId 即转入轮询，授权链接可复制
// 给执行机侧流程）。CLI 主路径（--api-key 两步弹窗，#181/#179）不动。
// B2 收编（#426）：面板 = 仓内 shadcn Card（bg-card + ring-1 ring-foreground/10 +
// 12px 边圆角 + shadow-lg，与 token-gate 门页同配方），字样 = 语义标签 + TW 工具
// 类直引 token 正本；per-face 样式（routes/machine-authorize.css）随片退役。
// 类名别名（authorize-*）原样保留在元素上（别名保留律 #411 政策 1）；新增
// e2e 钉扎面按同政策走语义 locator，不再新铸类名钉。提交钮走仓内 shadcn 件
// ui/Button brand 档，per-face 值以工具类钉回轨 A3 实测档——32px 高 / 8px
// 圆角 / 13px 中黑字重 / --card-button 实底：铺开是纯结构换件，per-face 数值
// 仍是几何正本（#411 政策 4），故不取 shadcn 默认档（默认档圆角 10px、字号
// 14px 均与本仓 canon 不符）。

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api/client.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { useI18n } from '../i18n/provider.js';

interface MachineJson {
  machineId: string;
  token: string;
  teamId: string;
  serverUrl: string;
}

type Phase = 'idle' | 'pending' | 'authorizing' | 'authorized' | 'expired' | 'error';

const POLL_INTERVAL_MS = 2_000;

/** 相位文案共用的一档字样（13px / 1.5 行高 / 次级墨）。 */
const DESC_CLASS = 'authorize-desc text-[13px] leading-normal text-content-secondary';

export function MachineAuthorizePage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [enrollId, setEnrollId] = useState(searchParams.get('enroll'));
  const [phase, setPhase] = useState<Phase>(enrollId !== null ? 'pending' : 'idle');
  const [machine, setMachine] = useState<MachineJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 终态后停轮询（unmount 亦停）。
  const stopped = useRef(false);
  useEffect(() => {
    stopped.current = false;
    return () => {
      stopped.current = true;
    };
  }, [enrollId]);

  // 轮询：pending 期每 2s poll；authorized/expired 终态停。
  useEffect(() => {
    if (enrollId === null || phase !== 'pending') return;
    const tick = async () => {
      try {
        const res = await api.post<{ status: string; machine?: MachineJson }>(
          '/api/machine/enroll/poll',
          { enrollId },
        );
        if (stopped.current) return;
        if (res.status === 'authorized' && res.machine) {
          setMachine(res.machine);
          setPhase('authorized');
        } else if (res.status === 'expired') {
          setPhase('expired');
        }
      } catch {
        // 网络抖动不终态——下一轮 poll 兜底（TTL 面归 server）。
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enrollId, phase]);

  const startEnrollment = async (): Promise<void> => {
    setError(null);
    try {
      const res = await api.post<{ enrollId: string }>('/api/machine/enroll/start', {});
      setEnrollId(res.enrollId);
      setPhase('pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const confirm = async (): Promise<void> => {
    if (enrollId === null || phase !== 'pending') return;
    setPhase('authorizing');
    setError(null);
    try {
      const res = await api.post<{ machine: MachineJson }>('/api/machine/enroll/confirm', {
        enrollId,
      });
      setMachine(res.machine);
      setPhase('authorized');
    } catch (err) {
      // 409（已确认）/404（失效）→ 失效文案；网络错 → 通用文案，停留。
      setPhase('pending');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    // 独立路由页（pathless 布局，不在 app 壳内）：画布底色铺满视口。底色取
    // --background（B 页面第一档，board-main 同款），不取 --surface-secondary：
    // 暗色下 --surface-secondary 与 Card 的 bg-card 同值 #1f1f23，面板会与底同色。
    <div className="authorize-backdrop fixed inset-0 flex items-center justify-center bg-background">
      <Card
        role="region"
        aria-label={t('授权机器')}
        className="authorize-card w-[360px] max-w-[calc(100vw-48px)] gap-3 rounded-[12px] p-6 shadow-lg"
      >
        <h1 className="authorize-title text-base font-semibold text-foreground">{t('授权机器')}</h1>
        {phase === 'idle' && (
          <>
            <p className={DESC_CLASS}>{t('生成授权链接，在执行机上完成注册发起。')}</p>
            <Button
              variant="brand"
              className="authorize-submit w-full border-0 rounded-md px-3 text-[13px] font-medium"
              onClick={() => void startEnrollment()}
            >
              {t('生成授权链接')}
            </Button>
          </>
        )}
        {phase === 'pending' && (
          <>
            <p className={DESC_CLASS}>
              {t('一台执行机请求加入你的团队。确认后它将以自己的凭据连接。')}
            </p>
            <Button
              variant="brand"
              className="authorize-submit w-full border-0 rounded-md px-3 text-[13px] font-medium"
              onClick={() => void confirm()}
            >
              {t('确认授权')}
            </Button>
          </>
        )}
        {phase === 'authorizing' && <p className={DESC_CLASS}>{t('正在授权…')}</p>}
        {phase === 'authorized' && machine !== null && (
          <>
            <p className={DESC_CLASS}>{t('授权完成，机器已注册。')}</p>
            <p className="authorize-meta text-xs break-all text-content-tertiary">
              machineId: {machine.machineId}
            </p>
          </>
        )}
        {phase === 'expired' && (
          <p className={DESC_CLASS}>{t('授权链接已失效，请在执行机上重新发起。')}</p>
        )}
        {error !== null && phase !== 'authorized' && (
          <p className="authorize-error text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
