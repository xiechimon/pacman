# #945 better-colors 本域实测（渲染对，双主题）

floor 口径（#943 判例）：canon 槽对按 spec/22 §1.7/1.8 自带实测阈值；消费面自造对 文本 4.5 / 非文本 UI 3.0。

| theme | face | fg | bg | ratio | floor | 判定 |
| --- | --- | --- | --- | --- | --- | --- |
| dark | agent text on surface | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | note tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | stamp tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | bubble primary on surface-secondary | #ede9e1 | #2d2a24 | 11.81 | 4.5 | PASS |
| dark | taskline title on surface | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | taskline seq secondary on code-bg | #d3cfc7 | #2d2a24 | 9.21 | 4.5 | PASS |
| dark | tool pill tertiary on surface-secondary | #b3afa8 | #2d2a24 | 6.55 | 4.5 | PASS |
| dark | tool output primary on code-bg | #ede9e1 | #2d2a24 | 11.81 | 4.5 | PASS |
| dark | md fence primary on code-bg | #ede9e1 | #2d2a24 | 11.81 | 4.5 | PASS |
| dark | md ordinal tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | pane head secondary on surface | #d3cfc7 | #25221d | 10.2 | 4.5 | PASS |
| dark | file row secondary on surface-secondary | #d3cfc7 | #2d2a24 | 9.21 | 4.5 | PASS |
| dark | hunk head tertiary on surface-secondary | #b3afa8 | #2d2a24 | 6.55 | 4.5 | PASS |
| dark | diff add fg on add bg | #d3cfc7 | #193822 | 8.29 | 4.5 | PASS |
| dark | gutter tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | file +N add fg on surface-secondary | #66c483 | #2d2a24 | 6.67 | 4.5 | PASS |
| dark | status chip confirm tone pair | #f4b973 | #422b0d | 7.6 | 4.5 | PASS |
| dark | status chip done tone pair | #8ddba2 | #193822 | 7.84 | 4.5 | PASS |
| dark | status chip idle tone pair | #b3afa8 | #2d2a24 | 6.55 | 4.5 | PASS |
| dark | status chip plan tone pair | #e0afff | #25221d | 8.86 | 4.5 | PASS |
| dark | head title primary on surface | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | head primary on-accent on card-button | #1e1b16 | #d89cfc | 8.24 | 4.5 | PASS |
| dark | seq tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | fresh title primary on surface | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | fresh nodesc tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | fresh start on-accent on card-button | #1e1b16 | #d89cfc | 8.24 | 4.5 | PASS |
| dark | placeholder tertiary on surface-secondary | #b3afa8 | #2d2a24 | 6.55 | 4.5 | PASS |
| dark | send idle tertiary on seg-active | #b3afa8 | #3f3c36 | 5.03 | 3 | PASS |
| dark | stop glyph on seg-active | #ffaab9 | #3f3c36 | 6.12 | 3 | PASS |
| dark | fab badge on-accent on card-button | #1e1b16 | #d89cfc | 8.24 | 4.5 | PASS |
| dark | fab tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | range chip secondary on range-chip-bg | #d3cfc7 | #2d2a24 | 9.21 | 4.5 | PASS |
| dark | changes stat tertiary on surface | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | changes +N add fg on surface | #66c483 | #25221d | 7.39 | 4.5 | PASS |
| dark | changes -N danger on surface | #ffaab9 | #25221d | 8.83 | 3 | PASS |
| dark | menu name primary on popover-bg | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | menu row secondary on popover-bg | #d3cfc7 | #25221d | 10.2 | 4.5 | PASS |
| dark | seg off tertiary on popover-bg | #b3afa8 | #25221d | 7.25 | 4.5 | PASS |
| dark | seg on secondary on seg-active | #d3cfc7 | #3f3c36 | 7.07 | 4.5 | PASS |
| dark | overlay title primary on popover-bg | #ede9e1 | #25221d | 13.09 | 4.5 | PASS |
| dark | rerun info secondary on popover-bg | #d3cfc7 | #25221d | 10.2 | 4.5 | PASS |
| light | agent text on surface | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | note tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | stamp tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | bubble primary on surface-secondary | #120f09 | #e8e3da | 14.96 | 4.5 | PASS |
| light | taskline title on surface | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | taskline seq secondary on code-bg | #35312a | #e8e3da | 10.12 | 4.5 | PASS |
| light | tool pill tertiary on surface-secondary | #57534c | #e8e3da | 5.98 | 4.5 | PASS |
| light | tool output primary on code-bg | #120f09 | #e8e3da | 14.96 | 4.5 | PASS |
| light | md fence primary on code-bg | #120f09 | #e8e3da | 14.96 | 4.5 | PASS |
| light | md ordinal tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | pane head secondary on surface | #35312a | #efe9e1 | 10.72 | 4.5 | PASS |
| light | file row secondary on surface-secondary | #35312a | #e8e3da | 10.12 | 4.5 | PASS |
| light | hunk head tertiary on surface-secondary | #57534c | #e8e3da | 5.98 | 4.5 | PASS |
| light | diff add fg on add bg | #35312a | #c2f5ce | 10.62 | 4.5 | PASS |
| light | gutter tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | file +N add fg on surface-secondary | #005f2d | #e8e3da | 6.14 | 4.5 | PASS |
| light | status chip confirm tone pair | #825100 | #ffe5c8 | 5.53 | 4.5 | PASS |
| light | status chip done tone pair | #004c23 | #c2f5ce | 8.38 | 4.5 | PASS |
| light | status chip idle tone pair | #57534c | #e8e3da | 5.98 | 4.5 | PASS |
| light | status chip plan tone pair | #562071 | #efe9e1 | 9.46 | 4.5 | PASS |
| light | head title primary on surface | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | head primary on-accent on card-button | #ffffff | #7f2da7 | 7.41 | 4.5 | PASS |
| light | seq tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | fresh title primary on surface | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | fresh nodesc tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | fresh start on-accent on card-button | #ffffff | #7f2da7 | 7.41 | 4.5 | PASS |
| light | placeholder tertiary on surface-secondary | #57534c | #e8e3da | 5.98 | 4.5 | PASS |
| light | send idle tertiary on seg-active | #57534c | #e0dbd2 | 5.55 | 3 | PASS |
| light | stop glyph on seg-active | #9d2c4c | #e0dbd2 | 5.26 | 3 | PASS |
| light | fab badge on-accent on card-button | #ffffff | #7f2da7 | 7.41 | 4.5 | PASS |
| light | fab tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | range chip secondary on range-chip-bg | #35312a | #e8e3da | 10.12 | 4.5 | PASS |
| light | changes stat tertiary on surface | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | changes +N add fg on surface | #005f2d | #efe9e1 | 6.51 | 4.5 | PASS |
| light | changes -N danger on surface | #9d2c4c | #efe9e1 | 6.01 | 3 | PASS |
| light | menu name primary on popover-bg | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | menu row secondary on popover-bg | #35312a | #efe9e1 | 10.72 | 4.5 | PASS |
| light | seg off tertiary on popover-bg | #57534c | #efe9e1 | 6.34 | 4.5 | PASS |
| light | seg on secondary on seg-active | #35312a | #e0dbd2 | 9.38 | 4.5 | PASS |
| light | overlay title primary on popover-bg | #120f09 | #efe9e1 | 15.86 | 4.5 | PASS |
| light | rerun info secondary on popover-bg | #35312a | #efe9e1 | 10.72 | 4.5 | PASS |
