// 兜底模型列表字段（XMON-46）——agent 概览编辑面与创建 Agent 弹窗共用的一面。
// 两个挂载点的容器不同（概览 = `.agent-field` 列，弹窗 = `.dlg-form` 表单列），
// 面本身逐字相同，故只做一个组件、一套类名：行/添加位几何住 agent-detail.css
// 的 `.agent-fb*` 族（与 `.agent-model*` 同组），不按挂载点复制。
//
// 交互三件（票面「有序多选」）：
//   添加 = 复用 AgentModelSelect（`withEmptyOption: false`：添加位是即用即弃的
//          选择器，没有「清空」对象），候选 = toModelOptions 投影挖去主模型与
//          已选条目（同一模型不出两行）；
//   排序 = 每行上移/下移（相邻换位，越界钮禁用）；
//   删除 = 每行移除。
// 提交形状由调用面按 create/patch 两律选取（见 agent-fallback-models.ts）——
// 本组件只负责把新列表交回去。

import type { ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ArrowUp, X } from '../icons/index.js';
import {
  addFallback,
  type FallbackEntry,
  fallbackCandidates,
  fallbackLabel,
  fallbackProvider,
  type MainModel,
  moveFallback,
  removeFallback,
} from './agent-fallback-models.js';
import { AgentModelSelect } from './agent-model-select.js';

interface AgentFallbackFieldProps {
  /** 当前列表（live = agent 记录真值；fixture = 场景记录），有序。 */
  value: FallbackEntry[];
  /** 主模型当前值——候选去重与空 provider 槽的归属都按它解析。 */
  main: MainModel;
  /** 模型候选（`toModelOptions` 投影单源）。 */
  options: ModelOption[];
  onChange: (next: FallbackEntry[]) => void;
}

export function AgentFallbackField({ value, main, options, onChange }: AgentFallbackFieldProps) {
  const { t } = useI18n();
  const candidates = fallbackCandidates(options, main, value);
  return (
    <div className="agent-fb">
      <div className="agent-field-head">
        <span className="agent-field-label">{t('兜底模型')}</span>
      </div>
      {value.length > 0 && (
        <ol className="agent-fb-rows">
          {value.map((entry, i) => {
            // provider 标签：同名模型分属两个 provider 时，行才分得开（选择器
            // 行同律）。选项未命中时不出——名字已是裸串。
            const providerLabel = fallbackProvider(entry, main, options);
            return (
              <li
                className="agent-fb-row"
                // 同槽不可能重复（添加位幂等 + 候选已过滤），槽值即稳定身份
                key={`${entry.provider ?? ''}/${entry.modelId}`}
              >
                <span className="agent-fb-name">{fallbackLabel(entry, main, options)}</span>
                {providerLabel !== null && (
                  <span className="agent-fb-provider">{providerLabel}</span>
                )}
                <span className="agent-fb-actions">
                  <button
                    type="button"
                    className="agent-fb-btn"
                    aria-label={t('上移')}
                    disabled={i === 0}
                    onClick={() => onChange(moveFallback(value, i, -1))}
                  >
                    <ArrowUp width={12} height={12} />
                  </button>
                  <button
                    type="button"
                    className="agent-fb-btn agent-fb-down"
                    aria-label={t('下移')}
                    disabled={i === value.length - 1}
                    onClick={() => onChange(moveFallback(value, i, 1))}
                  >
                    <ArrowUp width={12} height={12} />
                  </button>
                  <button
                    type="button"
                    className="agent-fb-btn"
                    aria-label={t('移除')}
                    onClick={() => onChange(removeFallback(value, i))}
                  >
                    <X width={12} height={12} />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {/* 候选空（选项被选光或只有主模型）→ 添加位不出：面里没有可加的东西，
          摆一个点了没反应的钮只会骗人。 */}
      {candidates.length > 0 && (
        <AgentModelSelect
          value={null}
          options={candidates}
          withEmptyOption={false}
          emptyLabel={t('添加兜底模型')}
          onPick={(next) => {
            if (next !== null) onChange(addFallback(value, next));
          }}
          prefix="agent-fb-add"
        />
      )}
      <p className="agent-field-hint">
        {t('主模型调用失败时，按顺序依次改用这些模型重试；留空 = 不兜底。')}
      </p>
    </div>
  );
}
