# #915 对比度验收复测（contrast.md C 段 × 翻值后 live token 对账）

- 复测器：`library/t-0909/scripts/measure-912.mjs`（WCAG 2.1 亮度比，逐对实测非估计；
  算法与 #909 正本生成器 gen-palettes.mjs 同源）
- 复测输入：翻转后的 `apps/web/src/styles/shadcn.css` + `tokens.css`（live 值）
- 复测快照：`docs/verify/915/token-scale-912-postflip.json`
- 对账基准：`library/t-0909/reports/contrast.md` § C · 纸兰（#909 定版实测表）

## 槽位状态（flip=0 = live 值与 c.css 定版值逐项一致）

| mode | unchanged | flip | new | retired | retire-candidate |
| --- | --- | --- | --- | --- | --- |
| dark | 109 | 0 | 0 | 0 | 2 |
| light | 109 | 0 | 0 | 0 | 2 |

注：`--toggle-track`/`--toggle-knob` 计入 unchanged（retire-candidate 状态位）——
两槽消费点（detail/overlays.css .dlg-toggle、secondary.css .account-switch-knob）
仍是活 UI，删槽推迟到消费面迁移波次（#947/#951），本票按 spec/22 §1.7/§1.8 翻值。

## 门控结果

- dark: 111 对（门控 90），FAIL 0，最低门控比 1.56:1（--input on --background）
- light: 111 对（门控 90），FAIL 0，最低门控比 1.52:1（--input on --background）

## C 段逐对比对

- C 段表行数：64
- 比率逐项一致（±0.005）：64（其中 14 对为 measure-912 正典角色对之外的组合，按翻值后 live 值同算法补测）
- report-only/info 对（非 AA 门控，仍逐项核对比率）：2
- live 测量缺对：0
- 不一致：0

结论：翻值后 live token 的对比度读数与 #909 定版 C 段实测表逐项一致，双模 AA 门控 0 未过。验收通过。

