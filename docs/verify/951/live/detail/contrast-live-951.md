# #951 live-only 面对比度实测（drive-951-detail，渲染对）

floor 口径同 contrast-951.md（canon 槽对 / text 4.5 / ui 3.0 / report 只报数）。

| face | fg | bg | ratio | kind | 判定 |
| --- | --- | --- | --- | --- | --- |
| agent slot label primary on popover-bg | #120f09 | #efe9e1 | 15.86 | canon 13.09/4.5 | PASS |
| machine pill primary on surface (live) | #120f09 | #efe9e1 | 15.86 | canon 14.17/4.5 | PASS |
| machine dot badge-done on surface (live) | #006f36 | #efe9e1 | 5.23 | ui | PASS |
| dir box tertiary on surface (live) | #57534c | #efe9e1 | 6.34 | canon tertiary 7.86/4.5 | PASS |
| switch track unchecked vs pane bg (§4-1 report-only) | #120f09 | #efe9e1 | 15.86 | report | REPORT |
| stop label primary on popover-bg | #120f09 | #efe9e1 | 15.86 | canon 13.09/4.5 | PASS |
| stop cancel tertiary on popover-bg | #57534c | #efe9e1 | 6.34 | canon tertiary 7.86/4.5 | PASS |
| review row primary on surface (live) | #120f09 | #dfcfd9 | 12.81 | canon 14.17/4.5 | PASS |
| review row name primary on surface | #120f09 | #dfcfd9 | 12.81 | canon 14.17/4.5 | PASS |
| focus textarea primary on surface (live) | #120f09 | #efe9e1 | 15.86 | canon 14.17/4.5 | PASS |
| review start on-accent on card-button | #ffffff | #7f2da7 | 7.41 | canon 8.24/4.5 | PASS |
