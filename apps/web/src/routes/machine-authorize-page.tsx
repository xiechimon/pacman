// 浏览器授权页（W4 #285，02 §5.2 路径一）：enroll/start 返回的 capability
// URL 落地页——?enroll=<id> 到达 → poll 轮询（pending = 待授权卡 + 确认钮；
// authorized = 完成态；expired = 失效文案）→ confirm 建机（无 apiKey，capability
// 单次）。无参到达 = 本页自起 start（拿 enrollId 即转入轮询，授权链接可复制
// 给执行机侧流程）。CLI 主路径（--api-key 两步弹窗，#181/#179）不动。
// 视觉语言 = token-gate 族同款（surface 面板 + edge 圆角/阴影）。

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/provider.js';
import './machine-authorize.css';

interface MachineJson {
  machineId: string;
  token: string;
  teamId: string;
  serverUrl: string;
}

type Phase = 'idle' | 'pending' | 'authorizing' | 'authorized' | 'expired' | 'error';

const POLL_INTERVAL_MS = 2_000;

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
    <div className="authorize-backdrop">
      <section className="authorize-card" aria-label={t('授权机器')}>
        <h1 className="authorize-title">{t('授权机器')}</h1>
        {phase === 'idle' && (
          <>
            <p className="authorize-desc">{t('生成授权链接，在执行机上完成注册发起。')}</p>
            <button
              type="button"
              className="authorize-submit"
              onClick={() => void startEnrollment()}
            >
              {t('生成授权链接')}
            </button>
          </>
        )}
        {phase === 'pending' && (
          <>
            <p className="authorize-desc">
              {t('一台执行机请求加入你的团队。确认后它将以自己的凭据连接。')}
            </p>
            <button type="button" className="authorize-submit" onClick={() => void confirm()}>
              {t('确认授权')}
            </button>
          </>
        )}
        {phase === 'authorizing' && <p className="authorize-desc">{t('正在授权…')}</p>}
        {phase === 'authorized' && machine !== null && (
          <>
            <p className="authorize-desc">{t('授权完成，机器已注册。')}</p>
            <p className="authorize-meta">machineId: {machine.machineId}</p>
          </>
        )}
        {phase === 'expired' && (
          <p className="authorize-desc">{t('授权链接已失效，请在执行机上重新发起。')}</p>
        )}
        {error !== null && phase !== 'authorized' && (
          <p className="authorize-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
