// #1049 问答卡：chief ask_user 提问的可点交互面（选项/多选/自由文本，
// 一次多问）。数据源 = chief_stream 的 question 行（api/mappers
// askQuestionOfContent 投影；wire = shared askUserQuestionContentSchema）。
// pending 期可答可取消（回调上抛 → surface 的 mutations → SSE message 事件
// 重取翻面，S8 不持乐观态）；answered/cancelled 只读（已选项高亮 / 整卡
// 暗淡）。fixture 面不构造此行（问答是 live 交互场景），但组件对缺省回调
// 惰性（与恢复钮 accept 律同族纪律）。

import type { AskUserAnswer } from '@pacman/shared';
import { type Dispatch, type ReactNode, type SetStateAction, useMemo, useState } from 'react';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import type { ChiefStreamItem } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';

/** question 行投影形（mappers 产出；ChiefStreamItem 的 question 变体）。 */
export type ChiefQuestionItem = Extract<ChiefStreamItem, { kind: 'question' }>;

export interface ChiefQuestionCardProps {
  item: ChiefQuestionItem;
  /** live 面：提交回答（POST questions/{requestId}/answer）；缺省 = 惰性。 */
  onAnswer?: (input: { requestId: string; answers: AskUserAnswer[] }) => void;
  /** live 面：取消提问（POST questions/{requestId}/cancel）。 */
  onCancel?: (requestId: string) => void;
}

/** 单题本地作答形（渲染层状态；提交时折叠成 AskUserAnswer）。 */
type Draft = { kind: 'choices'; picked: string[] } | { kind: 'text'; value: string };

export function ChiefQuestionCard({ item, onAnswer, onCancel }: ChiefQuestionCardProps) {
  const { t } = useI18n();
  const pending = item.status === 'pending' && onAnswer !== undefined;
  const [drafts, setDrafts] = useState<Draft[]>(() => initialDrafts(item));

  const complete = useMemo(
    () =>
      pending &&
      drafts.every((draft, i) => {
        const question = item.questions[i];
        if (question === undefined || draft === undefined) return false;
        if (draft.kind === 'text') return draft.value.trim() !== '';
        return draft.picked.length >= 1;
      }),
    [pending, drafts, item.questions],
  );

  const submit = () => {
    if (!complete) return;
    onAnswer?.({
      requestId: item.requestId,
      answers: drafts.map((draft, i) => ({
        header: item.questions[i]?.header ?? '',
        ...(draft.kind === 'text' ? { text: draft.value.trim() } : { choices: draft.picked }),
      })),
    });
  };

  return (
    <div
      data-testid="chief-question-card"
      data-status={item.status}
      className={`rounded-lg border border-border p-3 ${
        item.status === 'cancelled' ? 'bg-muted/40 opacity-70' : 'bg-muted/30'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{t('总管提问')}</span>
        {item.status === 'pending' && <Badge variant="secondary">{t('等你回答')}</Badge>}
        {item.status === 'answered' && <Badge variant="secondary">{t('已回答')}</Badge>}
        {item.status === 'cancelled' && <Badge variant="outline">{t('已取消')}</Badge>}
      </div>
      <div className="flex flex-col gap-3">
        {item.questions.map((question, qi) => (
          <div key={qi} className="rounded-md border border-border bg-background p-2.5">
            <div className="text-xs font-medium text-muted-foreground">{question.header}</div>
            <div className="mt-0.5 text-sm text-foreground">{question.question}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {questionBlock(question, qi, item, pending, drafts, setDrafts, t('输入你的回答'))}
            </div>
          </div>
        ))}
      </div>
      {pending && (
        <div className="mt-2.5 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel?.(item.requestId)}
            disabled={onCancel === undefined}
          >
            {t('取消提问')}
          </Button>
          <Button size="sm" onClick={submit} disabled={!complete}>
            {t('提交回答')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** 单题渲染：选项题 = 按钮组（单选点选/多选 toggle；answered 态高亮已选），
 * 自由文本题 = 输入框（answered 态直显答案文本）。 */
function questionBlock(
  question: ChiefQuestionItem['questions'][number],
  qi: number,
  item: ChiefQuestionItem,
  pending: boolean,
  drafts: Draft[],
  setDrafts: Dispatch<SetStateAction<Draft[]>>,
  inputPlaceholder: string,
): ReactNode {
  if (question.options.length === 0) {
    if (item.status === 'answered') {
      return (
        <span
          data-testid={`chief-question-answer-${qi}`}
          className="w-full text-sm text-muted-foreground"
        >
          {item.answers?.[qi]?.text ?? ''}
        </span>
      );
    }
    const draft = drafts[qi];
    return (
      <Input
        data-testid={`chief-question-input-${qi}`}
        className="h-8 flex-1"
        placeholder={inputPlaceholder}
        value={draft?.kind === 'text' ? draft.value : ''}
        disabled={!pending}
        onChange={(e) => {
          const value = e.target.value;
          setDrafts((prev) => replaceDraft(prev, qi, { kind: 'text', value }));
        }}
      />
    );
  }
  const answeredChoices = item.status === 'answered' ? (item.answers?.[qi]?.choices ?? null) : null;
  return question.options.map((option, oi) => {
    const draft = drafts[qi];
    const picked = draft?.kind === 'choices' ? draft.picked.includes(option.label) : false;
    const answeredPicked = answeredChoices?.includes(option.label) === true;
    return (
      <Button
        key={oi}
        variant={picked || answeredPicked ? 'default' : 'secondary'}
        size="sm"
        className="h-7 justify-start text-left"
        data-testid={`chief-question-option-${qi}-${oi}`}
        disabled={!pending}
        title={option.description}
        onClick={() => {
          setDrafts((prev) => {
            const current = prev[qi];
            const currentPicked = current?.kind === 'choices' ? current.picked : [];
            if (question.multiSelect === true) {
              const next = currentPicked.includes(option.label)
                ? currentPicked.filter((l) => l !== option.label)
                : [...currentPicked, option.label];
              return replaceDraft(prev, qi, { kind: 'choices', picked: next });
            }
            return replaceDraft(prev, qi, { kind: 'choices', picked: [option.label] });
          });
        }}
      >
        {option.label}
      </Button>
    );
  });
}

function initialDrafts(item: ChiefQuestionItem): Draft[] {
  return item.questions.map((question) =>
    question.options.length === 0
      ? { kind: 'text' as const, value: '' }
      : { kind: 'choices' as const, picked: [] },
  );
}

function replaceDraft(prev: Draft[], qi: number, next: Draft): Draft[] {
  const copy = [...prev];
  copy[qi] = next;
  return copy;
}
