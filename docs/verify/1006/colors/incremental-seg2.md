# #1006 detail-b — better-colors incremental-face measurement (segment 2)

Formula: WCAG 2.1 relative luminance, (Lhi+0.05)/(Llo+0.05); translucent layers composited over their real base (measure-912 canon). Sealed-ledger check: popover-foreground/popover, primary-foreground/primary, foreground/background are sealed PASS in docs/verify/953 (reference rows here); the three incremental pairs are NOT-SEALED there.

## dark — 4 PASS / 1 FAIL

| pair | face | values | ratio | threshold | result |
| --- | --- | --- | --- | --- | --- |
| destructive-btn-on-footer-band | 停止/确认重置钮（destructive 档，R3 裁决）：text-destructive 落 bg-destructive/20 over DialogFooter band(muted/50 over popover)——逐层合成实测 | fg #ffabb7 on bg #554141 (composited) | 5.3 | 4.5 | PASS |
| destructive-btn-hover | 同上 hover 档：bg-destructive/30 合成 | fg #ffabb7 on bg #6a4e4f (composited) | 4.18 | 4.5 | FAIL |
| review-row-selected-spot-soft | review dialog agent 选中行：text-foreground 落 --spot-soft（card-button 14% over card 合成，token 定义逐字复刻） | fg #eee8e4 on bg #433239 (composited) | 9.86 | 4.5 | PASS |
| dialog-body-reference | 参考行（非增量）：dialog 正文 popover-foreground on popover——#988 封版 PASS，此处从渲染值复测留档 | fg #eee8e4 on bg #26221f | 13 | 4.5 | PASS |
| footer-primary-reference | 参考行（非增量）：footer 确认钮 primary-foreground on primary——#988 封版 PASS，复测留档 | fg #1f1b18 on bg #eee8e4 | 14.08 | 4.5 | PASS |

## light — 4 PASS / 1 FAIL

| pair | face | values | ratio | threshold | result |
| --- | --- | --- | --- | --- | --- |
| destructive-btn-on-footer-band | 停止/确认重置钮（destructive 档，R3 裁决）：text-destructive 落 bg-destructive/10 over DialogFooter band(muted/50 over popover)——逐层合成实测 | fg #9e2c49 on bg #e5d5d4 (composited) | 5.09 | 4.5 | PASS |
| destructive-btn-hover | 同上 hover 档：bg-destructive/20 合成 | fg #9e2c49 on bg #ddc2c4 (composited) | 4.33 | 4.5 | FAIL |
| review-row-selected-spot-soft | review dialog agent 选中行：text-foreground 落 --spot-soft（card-button 14% over card 合成，token 定义逐字复刻） | fg #120f0b on bg #e4cfd7 (composited) | 12.93 | 4.5 | PASS |
| dialog-body-reference | 参考行（非增量）：dialog 正文 popover-foreground on popover——#988 封版 PASS，此处从渲染值复测留档 | fg #120f0b on bg #f0ebe6 | 16.14 | 4.5 | PASS |
| footer-primary-reference | 参考行（非增量）：footer 确认钮 primary-foreground on primary——#988 封版 PASS，复测留档 | fg #fafafa on bg #120f0b | 18.31 | 4.5 | PASS |


## Finding disposition (better-colors reporting discipline)

`destructive-btn-hover` misses AA 4.5 in both modes (dark 4.18, light 4.33 —
measured, composited over the DialogFooter band). This is NOT a segment-2
recipe: `variant="destructive"` is the verbatim registry button recipe
(bg-destructive/10, hover /20, dark /20 -> /30) and main already consumes it
(agent-detail-page `agent-delete`); the pair was simply absent from the #988
sealed 109-pair ledger (verified NOT-SEALED). Per the skill: report the pair,
the measured value and the missed threshold — leave the colors alone; they are
a design decision (token layer is frozen; palette custody = user/coordinator).

Escalation options for the ruling queue (not executed in-lane):
1. accept as a transient hover state (static face passes 5.3/5.09);
2. deepen `--destructive` one notch at the token layer (#988 custody, re-seal
   the ledger and re-measure every destructive consumer);
3. keep destructive for stop/reset but move hover feedback off alpha
   (registry deviation — needs ledger registration).

R3 (stop = destructive) stands regardless: the ruling picked the semantic
variant; the contrast finding is about the palette x registry interaction, not
the variant choice.
