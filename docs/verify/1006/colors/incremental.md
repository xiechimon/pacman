# #1006 detail-a — better-colors incremental-face measurement

Formula: WCAG 2.1 relative luminance, (Lhi+0.05)/(Llo+0.05), identical to measure-912 canon. Source: rendered :root token values from the fixture stack (both modes), measured not estimated. Sealed-ledger check: docs/verify/953/measure-sealed/token-scale-912.json (the four incremental pairs are NOT-SEALED there; accent reference pair IS sealed PASS and re-measured here for the record).

## dark — 5 PASS / 0 FAIL

| pair | face | fg | bg | ratio | threshold | result |
| --- | --- | --- | --- | --- | --- | --- |
| badge-secondary-tertiary | right-pane 运行历史「当前」Badge secondary 档 + text-tertiary 墨（手搓 11px chip 收编 registry Badge，#1006/R5 同波） | --text-tertiary #b3aeaa | --secondary #2d2926 | 6.56 | 4.5 | PASS |
| ghost-hover-tertiary-on-muted | doc-expand-all / dhead icon 钮 hover:bg-muted 生效后的 tertiary 墨（中和串退役，registry ghost hover 反馈） | --text-tertiary #b3aeaa | --muted #2d2926 | 6.56 | 4.5 | PASS |
| link-primary-on-card | source-issue 链接 = registry link 档 text-primary，落 detail-main bg-(--card)（R4 裁决：品牌墨只做 spot，链接对齐 --primary） | --primary #eee8e4 | --card #26221f | 13 | 4.5 | PASS |
| ghost-hover-foreground-on-muted | diff-expand 满宽条 / 版本 chip 等 ghost hover:bg-muted 上的一级墨 | --foreground #eee8e4 | --muted #2d2926 | 11.87 | 4.5 | PASS |
| menu-focus-accent-reference | 参考行（非增量）：版本菜单/方案▾ 行 focus:bg-accent——该对已封 PASS，此处从渲染值复测留档 | --accent-foreground #eee8e4 | --accent #2d2926 | 11.87 | 4.5 | PASS |

## light — 5 PASS / 0 FAIL

| pair | face | fg | bg | ratio | threshold | result |
| --- | --- | --- | --- | --- | --- | --- |
| badge-secondary-tertiary | right-pane 运行历史「当前」Badge secondary 档 + text-tertiary 墨（手搓 11px chip 收编 registry Badge，#1006/R5 同波） | --text-tertiary #595450 | --secondary #eae4e0 | 5.94 | 4.5 | PASS |
| ghost-hover-tertiary-on-muted | doc-expand-all / dhead icon 钮 hover:bg-muted 生效后的 tertiary 墨（中和串退役，registry ghost hover 反馈） | --text-tertiary #595450 | --muted #eae4e0 | 5.94 | 4.5 | PASS |
| link-primary-on-card | source-issue 链接 = registry link 档 text-primary，落 detail-main bg-(--card)（R4 裁决：品牌墨只做 spot，链接对齐 --primary） | --primary #120f0b | --card #f0ebe6 | 16.14 | 4.5 | PASS |
| ghost-hover-foreground-on-muted | diff-expand 满宽条 / 版本 chip 等 ghost hover:bg-muted 上的一级墨 | --foreground #120f0b | --muted #eae4e0 | 15.17 | 4.5 | PASS |
| menu-focus-accent-reference | 参考行（非增量）：版本菜单/方案▾ 行 focus:bg-accent——该对已封 PASS，此处从渲染值复测留档 | --accent-foreground #120f0b | --accent #eae4e0 | 15.17 | 4.5 | PASS |

