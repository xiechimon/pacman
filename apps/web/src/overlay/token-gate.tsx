// Token 门页（#253，spec #247 D9）：鉴权开且 server 打回 401 时落页——
// 输入 → probe（api/auth.ts probeToken，裸 fetch 面）→ localStorage → 放行
// 原请求（client.ts 停车面唤醒 + SSE 重连，auth 单缝）。错 token：停留本页、
// 清输入、只显通用文案——server {error} 细节不透传（票 AC2）。鉴权关：
// gateOpen 永不置位，本组件恒不可见（零行为差）。
// A3-overlays 收编：输入 = ui/Input（36px 实测族）、提交 = ui/Button
// primary；token-gate-input/-submit 类名保留为 e2e 定位别名
// （token-gate.spec.ts），样式本体在 ui/input.css / ui/button.css。

import { type FormEvent, useEffect, useState } from 'react';
import { passGate, probeToken, useAuth } from '../api/auth.js';
import { useI18n } from '../i18n/provider.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import './token-gate.css';

export function TokenGate() {
  const { t } = useI18n();
  const auth = useAuth();
  const [value, setValue] = useState('');
  const [rejected, setRejected] = useState(false);
  const [probing, setProbing] = useState(false);

  // 每次开门清上一轮残值并聚焦（关门→再开 = 新一轮输入）。A3：输入收编
  // ui/Input 后 ref 不在其 props 类型上（原语暂无 ref 形态），聚焦改走
  // 既有 htmlFor/id 锚点 pacman-token-input。
  useEffect(() => {
    if (!auth.gateOpen) return;
    setValue('');
    setRejected(false);
    (document.getElementById('pacman-token-input') as HTMLInputElement | null)?.focus();
  }, [auth.gateOpen]);

  if (!auth.gateOpen) return null;

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const candidate = value.trim();
    if (candidate === '' || probing) return;
    setProbing(true);
    setRejected(false);
    void probeToken(candidate).then((accepted) => {
      if (accepted) {
        passGate(candidate);
      } else {
        // 无效/网络失败同律：停留、清输入、通用文案，localStorage 不落值
        setRejected(true);
        setValue('');
      }
      setProbing(false);
    });
  };

  return (
    <div className="token-gate-backdrop">
      <form
        className="token-gate"
        role="dialog"
        aria-modal="true"
        aria-label={t('需要访问令牌')}
        onSubmit={submit}
      >
        <h1 className="token-gate-title">{t('需要访问令牌')}</h1>
        <p className="token-gate-desc">{t('服务端已开启令牌鉴权，输入访问令牌后继续使用。')}</p>
        <label className="token-gate-label" htmlFor="pacman-token-input">
          {t('访问令牌')}
        </label>
        <Input
          id="pacman-token-input"
          className="token-gate-input"
          type="password"
          value={value}
          autoComplete="off"
          onChange={(event) => setValue(event.target.value)}
        />
        {rejected && (
          <p className="token-gate-error" role="alert">
            {t('令牌无效，请重试。')}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="standard"
          className="token-gate-submit"
          disabled={probing || value.trim() === ''}
        >
          {t('进入')}
        </Button>
      </form>
    </div>
  );
}
