// 总管设置 view (issue #72, r5 101–104): the gear swaps the whole content
// area to this surface — back button + centered title over a 766-wide
// centered column with the 4 tabs (Agent / 章程 / 记忆 / 关注与提醒). The
// tab row is real state; parity captures take the fixture's tab.

import { useState } from 'react';
import type { ChiefContent, ChiefSettingsTab } from '../fixtures/records.js';
import { ChevronDown, ChevronLeft, ChevronRight, ChiefFaceDashed } from '../icons/index.js';
import './chief.css';

const TABS: { id: ChiefSettingsTab; label: string }[] = [
  { id: 'agent', label: 'Agent' },
  { id: 'charter', label: '章程' },
  { id: 'memory', label: '记忆' },
  { id: 'watches', label: '关注与提醒' },
];

export function ChiefSettings({ chief, onBack }: { chief: ChiefContent; onBack: () => void }) {
  const [tab, setTab] = useState<ChiefSettingsTab>(chief.tab ?? 'agent');
  return (
    <div className="chief-settings" data-route-surface="chief-settings">
      <header className="chief-set-head">
        <button type="button" className="chief-set-back" aria-label="返回" onClick={onBack}>
          <ChevronLeft width={16} height={16} />
        </button>
        <h1 className="chief-set-title">总管设置</h1>
      </header>
      <div className="chief-set-col">
        <div className="chief-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              type="button"
              role="tab"
              key={t.id}
              aria-selected={tab === t.id}
              className={tab === t.id ? 'chief-tab is-active' : 'chief-tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'agent' && (
          <>
            <button type="button" className="chief-agent-row">
              <ChiefFaceDashed width={24} height={24} />
              <span>未设置</span>
              <ChevronRight width={14} height={14} className="chief-agent-chev" />
            </button>
            <div className="chief-compress">
              <div className="chief-compress-text">
                <h3>压缩模型</h3>
                <p>
                  压缩上下文时用来生成摘要的模型，选更快的模型可缩短等待。需要 tds CLI 0.1.49
                  及以上版本。
                </p>
              </div>
              <button type="button" className="chief-select">
                <span>默认（与 Chief 相同）</span>
                <ChevronDown width={12} height={12} />
              </button>
            </div>
          </>
        )}

        {tab === 'charter' && (
          <>
            <div className="chief-charter-empty">尚无章程。点击编辑，为总管添加常设指示。</div>
            <div className="chief-charter-actions">
              <button type="button" className="chief-edit-btn">
                编辑
              </button>
            </div>
          </>
        )}

        {tab === 'memory' && (
          <div className="chief-memo">
            尚未选择 Agent。请先在「Agent」页选定 Agent，记忆将保存在该 Agent 上。
          </div>
        )}

        {tab === 'watches' && (
          <div className="chief-watches">
            暂无跟进事项。总管关注某个任务，或约定到点回头核实时，会按主题列在这里。
          </div>
        )}
      </div>
    </div>
  );
}
