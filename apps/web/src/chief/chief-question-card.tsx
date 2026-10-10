// #1049 问答卡：chief ask_user 提问的可点交互面（选项/多选/自由文本，
// 一次多问）。数据源 = chief_stream 的 question 行（api/mappers
// askQuestionOfContent 投影；wire = shared askUserQuestionContentSchema）。
// 2026-10-09 形态裁决（用户亲选原型 scratch/qcard-proto v3「Steps」）：
// pending = 一题一屏向导——进度条 / 整行选项块 + 序号方块 / 末行「其他…」
// + 自由文本 / 数字键 1–N 直达 / 上一步-下一步-提交 / 选项 >6 卡内滚动 /
// 多选计数提示；几何逐值照抄原型 .v3 段。answered = 只读高亮（整行块 +
// 序号填充，自定义答案以选项串回显）；cancelled = 整卡暗淡。拼装只用
// registry 零件 Button/Input（shadcn 无「提问卡」原语，26 件快照已核）；
// 徽章/序号方块/进度条是卡内局部 span，不进 components/ui。组件对缺省
// 回调惰性（与恢复钮 accept 律同族纪律）。

import type { AskUserAnswer } from '@pacman/shared';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
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

/** 单题本地作答形（渲染层状态；提交时折叠成 AskUserAnswer）。choices 题
 * 的 other = 「其他…」行选中；提交时非空 otherText 追加进 choices（wire
 * 上选项题只收 choices，自定义文本以选项串上送，答题端点按题形执法）。 */
type Draft =
  | { kind: 'choices'; picked: string[]; other: boolean; otherText: string }
  | { kind: 'text'; value: string };

/** 原型 v3 几何（scratch/qcard-proto index.html 逐值）：卡框 / 进度条 /
 * 徽章 / 序号方块 / 整行选项块 / 自由文本输入。 */
const CARD_CLS =
  'flex flex-col gap-2.5 rounded-[var(--radius)] border border-border bg-background p-3';
const PIP_CLS = 'h-[3px] flex-1 rounded-full bg-border transition-colors duration-200 ease-out';
const PIP_ON_CLS = 'bg-primary';
const BADGE_CLS =
  'rounded-full border border-border bg-secondary px-[7px] py-px text-[11px] text-muted-foreground';
const BADGE_LIVE_CLS = 'border-transparent bg-primary text-primary-foreground';
const HINT_CLS = 'flex-1 text-[11px] text-muted-foreground';
const BIG_CLS = 'text-[15px] leading-[1.35] font-semibold text-foreground';
const NUM_CLS =
  'grid size-5 shrink-0 place-items-center rounded-[5px] border text-[11px] leading-none font-semibold';
const NUM_OFF_CLS = 'bg-secondary text-muted-foreground';
const NUM_ON_CLS = 'border-transparent bg-primary text-primary-foreground';
const OPT_CLS =
  'h-auto w-full justify-start gap-[9px] whitespace-normal rounded-[calc(var(--radius)-2px)] border-border bg-transparent px-3 py-[11px] text-left text-[13px] leading-normal font-normal';
const OPT_SEL_CLS = 'border-ring bg-secondary';
const OPT_TXT_CLS = 'min-w-0 flex-1';
const FREE_INPUT_CLS = 'h-auto rounded-[calc(var(--radius)-3px)] px-3 py-[11px] text-[13px]';
/** answered/cancelled 态的只读整行块（非交互：无焦点无手型）。 */
const ROW_STATIC_CLS =
  'flex w-full items-center gap-[9px] rounded-[calc(var(--radius)-2px)] border border-border px-3 py-[11px] text-[13px] leading-normal text-foreground';

export function ChiefQuestionCard({ item, onAnswer, onCancel }: ChiefQuestionCardProps) {
  const { t } = useI18n();
  const pending = item.status === 'pending' && onAnswer !== undefined;
  const [drafts, setDrafts] = useState<Draft[]>(() => initialDrafts(item));
  const [step, setStep] = useState(0);
  const total = item.questions.length;
  const lastStep = total - 1;
  const last = step === lastStep;
  const question = item.questions[step] ?? item.questions[0];
  const draft = drafts[step];

  /** 数字键 1–N 直达（原型 v3 底部提示的机制面）：pending 期挂窗口监听，
   * 焦点在输入类控件/富文本时不劫持；N = 选项数 + 1（末位 = 其他行）。 */
  useEffect(() => {
    if (!pending || question === undefined || question.options.length === 0) return;
    const max = question.options.length + 1;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      const n = Number.parseInt(e.key, 10);
      if (!Number.isInteger(n) || n < 1 || n > max) return;
      setDrafts((prev) => applyPick(prev, step, question, n - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pending, step, question]);

  const stepComplete = useMemo(() => draftComplete(draft, question), [draft, question]);
  const allComplete = useMemo(
    () => pending && item.questions.every((q, i) => draftComplete(drafts[i], q)),
    [pending, drafts, item.questions],
  );

  const submit = () => {
    if (!allComplete) return;
    onAnswer?.({
      requestId: item.requestId,
      answers: drafts.map((d, i) => {
        const header = item.questions[i]?.header ?? '';
        if (d.kind === 'text') return { header, text: d.value.trim() };
        const choices = [...d.picked];
        if (d.other && d.otherText.trim() !== '') choices.push(d.otherText.trim());
        return { header, choices };
      }),
    });
  };

  // hooks 已全部挂完才走早退（schema questions min(1)；空数组建卡本身
  // 就是 mapper 已过滤的坏形，防御性不渲染）。
  if (question === undefined) return null;

  if (item.status !== 'pending') {
    // answered / cancelled：只读记录面（answered 高亮已选整行块；cancelled
    // 整卡暗淡）。badge/块全部静态，无任何可点控件。
    return (
      <div
        data-testid="chief-question-card"
        data-status={item.status}
        className={`${CARD_CLS}${item.status === 'cancelled' ? ' opacity-70' : ''}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-foreground">{t('总管提问')}</span>
          {item.status === 'answered' ? (
            <span className={BADGE_CLS}>{t('已回答')}</span>
          ) : (
            <span className={`${BADGE_CLS} bg-transparent`}>{t('已取消')}</span>
          )}
        </div>
        <div className="flex flex-col gap-2.5">
          {item.questions.map((q, qi) => (
            <div key={qi} className="flex flex-col gap-1.5">
              <div className="text-[11px] text-muted-foreground">{q.header}</div>
              <div className="text-[13px] text-foreground">{q.question}</div>
              {q.options.length === 0 ? (
                <div
                  data-testid={`chief-question-answer-${qi}`}
                  className="rounded-[calc(var(--radius)-3px)] border border-input px-3 py-[11px] text-[13px] text-foreground"
                >
                  {item.answers?.[qi]?.text ?? ''}
                </div>
              ) : (
                answeredRows(q, qi, item.answers)
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // pending：Steps 向导（一题一屏）。onAnswer 缺省 = 惰性（控件全禁用）。
  const scroll = question.options.length > 6;
  const pickedCount = draft?.kind === 'choices' ? draft.picked.length : 0;
  const otherSelected = draft?.kind === 'choices' && draft.other;
  const hintText =
    question.options.length === 0
      ? ''
      : question.multiSelect === true
        ? pickedCount > 0
          ? t('已选 {n} 项', { n: pickedCount })
          : t('未选')
        : t('数字键 1–{n} 选择', { n: question.options.length + 1 });

  return (
    <div data-testid="chief-question-card" data-status={item.status} className={CARD_CLS}>
      <div className="flex gap-1" aria-hidden="true">
        {item.questions.map((_, i) => (
          <span key={i} className={`${PIP_CLS}${i <= step ? ` ${PIP_ON_CLS}` : ''}`} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] tracking-[0.02em] text-muted-foreground">
          {question.header} · {step + 1}/{total}
        </span>
        <span className={`${BADGE_CLS}${pending ? ` ${BADGE_LIVE_CLS}` : ''}`}>
          {t('等你回答')}
        </span>
      </div>
      <div className={BIG_CLS}>{question.question}</div>
      {question.options.length === 0 ? (
        <Input
          data-testid={`chief-question-input-${step}`}
          className={FREE_INPUT_CLS}
          placeholder={t('输入你的回答')}
          value={draft?.kind === 'text' ? draft.value : ''}
          disabled={!pending}
          onChange={(e) => {
            const value = e.target.value;
            setDrafts((prev) => replaceDraft(prev, step, { kind: 'text', value }));
          }}
        />
      ) : (
        <div
          className={`flex flex-col gap-1.5${scroll ? ' max-h-[216px] overflow-y-auto pr-0.5' : ''}`}
        >
          {question.options.map((option, oi) => {
            const selected = draft?.kind === 'choices' && draft.picked.includes(option.label);
            return (
              <Button
                key={oi}
                variant="outline"
                size="sm"
                data-testid={`chief-question-option-${step}-${oi}`}
                disabled={!pending}
                aria-pressed={selected}
                title={option.description}
                className={`${OPT_CLS}${selected ? ` ${OPT_SEL_CLS}` : ''}`}
                onClick={() => setDrafts((prev) => applyPick(prev, step, question, oi))}
              >
                <span className={`${NUM_CLS} ${selected ? NUM_ON_CLS : NUM_OFF_CLS}`}>
                  {oi + 1}
                </span>
                <span className={OPT_TXT_CLS}>{option.label}</span>
              </Button>
            );
          })}
          <Button
            key="other"
            variant="outline"
            size="sm"
            data-testid={`chief-question-other-${step}`}
            disabled={!pending}
            aria-pressed={otherSelected}
            className={`${OPT_CLS}${otherSelected ? ` ${OPT_SEL_CLS}` : ''}`}
            onClick={() =>
              setDrafts((prev) => applyPick(prev, step, question, question.options.length))
            }
          >
            <span className={`${NUM_CLS} ${otherSelected ? NUM_ON_CLS : NUM_OFF_CLS}`}>
              {question.options.length + 1}
            </span>
            <span className={OPT_TXT_CLS}>{t('其他…')}</span>
          </Button>
          {otherSelected && (
            <Input
              data-testid={`chief-question-input-${step}`}
              className={FREE_INPUT_CLS}
              placeholder={t('输入你的回答')}
              value={draft?.kind === 'choices' ? draft.otherText : ''}
              disabled={!pending}
              onChange={(e) => {
                const value = e.target.value;
                setDrafts((prev) => {
                  const current = prev[step];
                  if (current?.kind !== 'choices') return prev;
                  return replaceDraft(prev, step, { ...current, otherText: value });
                });
              }}
            />
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={!pending || onCancel === undefined}
          onClick={() => onCancel?.(item.requestId)}
        >
          {t('取消提问')}
        </Button>
        <span className={HINT_CLS}>{hintText}</span>
        {step > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={!pending}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            {t('上一步')}
          </Button>
        )}
        <Button
          size="sm"
          disabled={!pending || !(last ? allComplete : stepComplete)}
          onClick={() => {
            if (last) submit();
            else setStep((s) => Math.min(lastStep, s + 1));
          }}
        >
          {last ? t('提交回答') : t('下一步')}
        </Button>
      </div>
    </div>
  );
}

/** answered 态选项题：全部选项行只读回显（已选 = 整行块 + 序号填充）；
 * choices 里不匹配任何选项 label 的串 = 「其他…」自定义答案，追加一条
 * 选中态行回显（testid 落在答案文本上）。 */
function answeredRows(
  question: ChiefQuestionItem['questions'][number],
  qi: number,
  answers: { header: string; choices?: string[]; text?: string }[] | null,
): ReactNode {
  const choices = answers?.[qi]?.choices ?? null;
  const otherAnswers =
    choices === null ? [] : choices.filter((c) => !question.options.some((o) => o.label === c));
  return (
    <div className="flex flex-col gap-1.5">
      {question.options.map((option, oi) => {
        const picked = choices?.includes(option.label) === true;
        return (
          <div
            key={oi}
            data-testid={`chief-question-option-${qi}-${oi}`}
            className={`${ROW_STATIC_CLS}${picked ? ' border-ring bg-secondary' : ''}`}
          >
            <span className={`${NUM_CLS} ${picked ? NUM_ON_CLS : NUM_OFF_CLS}`}>{oi + 1}</span>
            <span className={OPT_TXT_CLS}>{option.label}</span>
          </div>
        );
      })}
      {otherAnswers.length > 0 && (
        <div className={`${ROW_STATIC_CLS} border-ring bg-secondary`}>
          <span className={`${NUM_CLS} ${NUM_ON_CLS}`}>{question.options.length + 1}</span>
          <span data-testid={`chief-question-answer-${qi}`} className={OPT_TXT_CLS}>
            {otherAnswers.join('；')}
          </span>
        </div>
      )}
    </div>
  );
}

function initialDrafts(item: ChiefQuestionItem): Draft[] {
  return item.questions.map((q) =>
    q.options.length === 0
      ? { kind: 'text' as const, value: '' }
      : { kind: 'choices' as const, picked: [], other: false, otherText: '' },
  );
}

/** 整行选项块点选/数字键直达的纯函数面：单选 = 换选并清「其他」；多选 =
 * toggle；末位 index = 其他行（单选换位，多选 toggle）。 */
function applyPick(
  prev: Draft[],
  qi: number,
  question: ChiefQuestionItem['questions'][number],
  index: number,
): Draft[] {
  const current = prev[qi];
  if (current?.kind !== 'choices') return prev;
  if (index === question.options.length) {
    if (question.multiSelect === true)
      return replaceDraft(prev, qi, { ...current, other: !current.other });
    return replaceDraft(prev, qi, { ...current, picked: [], other: true });
  }
  const label = question.options[index]?.label;
  if (label === undefined) return prev;
  if (question.multiSelect === true) {
    const picked = current.picked.includes(label)
      ? current.picked.filter((l) => l !== label)
      : [...current.picked, label];
    return replaceDraft(prev, qi, { ...current, picked });
  }
  return replaceDraft(prev, qi, { ...current, picked: [label], other: false });
}

/** 单题完成判据：文本题非空；选项题 = 至少一个常规选项，或带非空自定义
 * 文本的「其他」。空文本的「其他」不算完成（提交时也被丢弃）。 */
function draftComplete(
  draft: Draft | undefined,
  question: ChiefQuestionItem['questions'][number] | undefined,
): boolean {
  if (draft === undefined || question === undefined) return false;
  if (draft.kind === 'text') return draft.value.trim() !== '';
  return draft.picked.length >= 1 || (draft.other && draft.otherText.trim() !== '');
}

function replaceDraft(prev: Draft[], qi: number, next: Draft): Draft[] {
  const copy = [...prev];
  copy[qi] = next;
  return copy;
}
