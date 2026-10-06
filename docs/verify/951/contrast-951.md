# #951 better-colors 本域实测（渲染对，双主题）

floor 口径（#943/#945 判例）：canon 槽对按 spec/22 §1.7/1.8 自带实测阈值；消费面自造对 文本 4.5 / 非文本 UI 3.0；report = §1.3 report-only 族（失能态不设地板，只报数对账）。

review/reject/stop-confirm 弹层与 reset 拖拽面不在 fixture 面——live drive 段实测/同槽对覆盖（脚本头注）。

| theme | face | fg | bg | ratio | floor | 判定 |
| --- | --- | --- | --- | --- | --- | --- |
| dark | token total num primary on surface | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | token unit tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | token model name secondary on surface | #d3cfc7 | #25221d | 10.2 | 4.5 | PASS |
| dark | token model total tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | token stat label tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | token stat value primary on surface | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | branch label tertiary on dialog-box-bg | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | branch value primary on dialog-box-bg | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | copy glyph tertiary on dialog-box-bg | #b3afa8 | #25221d | 7.25 | 3 | PASS |
| dark | machine pill primary on surface | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | machine dot badge-done on surface | #73d18f | #25221d | 8.49 | 3 | PASS |
| dark | machine chevron tertiary on surface | #b3afa8 | #25221d | 7.25 | 3 | PASS |
| dark | dir box tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | force desc tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | pr slot (未创建) tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | sync label spot-disabled-fg on spot-disabled | #e6bffd | #906ba3 | 2.75 | — | REPORT |
| dark | switch track unchecked vs pane bg (§4-1 report-only) | #3a3731 | #25221d | 1.33 | — | REPORT |
| dark | history label primary on surface | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | history meta tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | history glyph (done/stop/ring) on surface | #ede9e1 | #25221d | 13.09 | 3 | PASS |
| dark | accept checkbox label primary on popover-bg | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | accept cancel tertiary on popover-bg | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | accept done on-accent on card-button | #1e1b16 | #d89cfc | 8.24 | 4.5 | PASS |
| dark | dialog branch value primary on dialog-box-bg | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | dialog machine pill primary on surface | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | dialog dir box tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | dialog sync label spot-disabled-fg on spot-disabled | #e6bffd | #906ba3 | 2.75 | — | REPORT |
| dark | dialog git PR slot tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | agent warn secondary on surface | #d3cfc7 | #25221d | 10.2 | 4.5 | PASS |
| dark | agent configure link (inherit) on surface | #d3cfc7 | #25221d | 10.2 | 4.5 | PASS |
| light | token total num primary on surface | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | token unit tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | token model name secondary on surface | #35312a | #efe9e1 | 10.72 | 4.5 | PASS |
| light | token model total tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | token stat label tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | token stat value primary on surface | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | branch label tertiary on dialog-box-bg | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | branch value primary on dialog-box-bg | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | copy glyph tertiary on dialog-box-bg | #57534c | #efe9e1 | 6.34 | 3 | PASS |
| light | machine pill primary on surface | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | machine dot badge-done on surface | #006f36 | #efe9e1 | 5.23 | 3 | PASS |
| light | machine chevron tertiary on surface | #57534c | #efe9e1 | 6.34 | 3 | PASS |
| light | dir box tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | force desc tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | pr slot (未创建) tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | sync label spot-disabled-fg on spot-disabled | #ffffff | #ac78be | 3.4 | — | REPORT |
| light | switch track unchecked vs pane bg (§4-1 report-only) | #c9c4bc | #efe9e1 | 1.44 | — | REPORT |
| light | history label primary on surface | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | history meta tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | history glyph (done/stop/ring) on surface | #120f09 | #efe9e1 | 15.86 | 3 | PASS |
| light | accept checkbox label primary on popover-bg | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | accept cancel tertiary on popover-bg | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | accept done on-accent on card-button | #ffffff | #7f2da7 | 7.41 | 4.5 | PASS |
| light | dialog branch value primary on dialog-box-bg | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | dialog machine pill primary on surface | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | dialog dir box tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | dialog sync label spot-disabled-fg on spot-disabled | #ffffff | #ac78be | 3.4 | — | REPORT |
| light | dialog git PR slot tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | agent warn secondary on surface | #35312a | #efe9e1 | 10.72 | 4.5 | PASS |
| light | agent configure link (inherit) on surface | #35312a | #efe9e1 | 10.72 | 4.5 | PASS |
