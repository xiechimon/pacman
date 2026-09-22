// Feedback route (issue #70, r2 32): intro line, 类型 chip row with Bug
// selected, the composer card (placeholder + mic/attach/applet toolbar +
// disabled 发送) and the 你的反馈 history empty state. Copy verbatim
// from the 32 bitmap (docs/research/assets/r2/32-反馈页.png), which is
// the authority over the r2 §6.8 prose summary — the bitmap shows three
// chips (Bug/功能建议/其他) and the intro line the summary omits.
import { useSearchParams } from 'react-router';
import { resolveScenario } from '../fixtures/scenario.js';
import { Grid2x2, Mic, Paperclip } from '../icons/index.js';
import { SecondaryShell } from '../secondary/shell.js';

const CATEGORIES = ['Bug', '功能建议', '其他'];
const SELECTED = 'Bug';

export function FeedbackPage() {
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  return (
    <SecondaryShell route="feedback" fixture={fixture} title="反馈">
      <p className="fb-intro">
        报告缺陷、提出功能建议，或指出使用中的不便之处。每一条我们都会查看。
      </p>
      <div className="fb-types">
        <span className="fb-types-label">类型</span>
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            className={`fb-chip${category === SELECTED ? ' fb-chip--active' : ''}`}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="fb-composer">
        <textarea className="fb-input" placeholder="发生了什么？你期望的结果是什么？" readOnly />
        <div className="fb-toolbar">
          <button type="button" aria-label="语音输入">
            <Mic />
          </button>
          <button type="button" aria-label="添加附件">
            <Paperclip />
          </button>
          <button type="button" aria-label="添加应用">
            <Grid2x2 />
          </button>
          <button type="button" className="fb-send" disabled>
            发送
          </button>
        </div>
      </div>
      <h2 className="fb-history-title">你的反馈</h2>
      <p className="fb-history-empty">尚未提交过反馈。</p>
    </SecondaryShell>
  );
}
