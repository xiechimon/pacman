# #651 验证证据：总管抽屉流式输出 + 可滚动

栈与驱动同 `docs/verify/650/README.md`（同一批 run，stub LLM 分块流式回复）。

## 文件

| 文件 | 内容 |
|---|---|
| `after-midstream-1.png` | 回合进行中：打字面已上屏第一段（「**凭证链路验证**已完成，」粗体即时渲染），用户行品红头像在位 |
| `after-midstream-2.png` | 增量第二段上屏（bullet 段进入），文本长度较上一张增长 |
| `after-midstream-3.png` | 增量第三段上屏（代码 chip 段进入） |
| `after-final.png` | 终稿 message 落库后：打字面收敛退场，定稿行带 foot（复制钮），全文一条不重复 |
| `before-final.png` | origin/main：整段一次性蹦出的定稿面（进行中 34 个采样点文本长度恒 0，见 `result-before.json` 时间线） |
| `result-before.json` | before 面 checks 7/7：`before-one-shot`（长度序列 `[79]`，0 → 整段）/ `before-midrun-empty` / `before-body-clipped`（`.chief-body` overflow hidden 裁切不可滚） |
| `result-after.json` | after 面 checks 13/13：`stream-incremental`（长度序列 `[10,15,29,39,64]`）/ `midstream-visible` / `final-foot-present` / `single-robot-row` / `body-scrollable`（overflow-y auto） |

## 判读

- 增量：after 时间线 5 个不同长度值（250ms 聚合窗口粒度）；before 时间线
  进行中恒 0、收尾一跳 79。
- 收敛：after 终稿后 robot 行恰 1 条、foot 归位、打字面无残留。
- 滚动：before `.chief-body` = hidden（长线程裁死）；after = auto，打开落底 +
  打字期近底跟随（参考站 todos.dev 实测同律，见 #651 评论）。
