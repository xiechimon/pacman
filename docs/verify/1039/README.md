# #1039 验证证据——changelog 单行链改每票一文件

票面判据:「两条车道各追加一条记录,合并时不需要任何手工解冲突」+ 历史零丢失。本目录归档三件:

| 文件 | 证明什么 | 怎么来的 |
|---|---|---|
| `repro-merge.sh` + `repro-old.txt` | **改前**:两条车道各往 `Last updated:` 链首挂一条(8176650a = 改前 origin/main),真实 3-way merge → `CONFLICT (content): Merge conflict in SKILL.md` | 每车道一个 detached worktree、真实 commit(过 pre-commit 钩子)、真实 `git merge` |
| `repro-new.txt` | **改后**:同样两条车道、各新建 `changelog/2026-10-09-<票号>.md`(9fe4ec0 = 迁移提交),同一 merge → `Merge made by the 'ort' strategy`,两文件俱在、全树零冲突标记 | 同上,仅写入形态不同 |
| `conservation-check.mjs` + `conservation.txt` | **零丢失**:49 条输入块(34 SKILL 链 + 13 map 链去重后 + 2 尾注)逐字节等值出现在 40 个产出文件的 49 个 section;两个源文件零残留旧 token | 校验器从 git 基线 8176650a 重取原链重切块,与盘上 changelog/ 多重集对拍——独立于迁移脚本自身 |

复跑:

```sh
sh docs/verify/1039/repro-merge.sh 8176650a old   # 期望 CONFLICT
sh docs/verify/1039/repro-merge.sh <迁移提交SHA> new   # 期望 clean
node docs/verify/1039/conservation-check.mjs      # 期望 PASS 两行
```

附加事实(迁移期实测):features/README.md 链的 `：前序:` 两侧有 **11 条字节级重复条目**(A/B 两半同文),按纯重复去重;守恒校验以多重集对拍覆盖该去重。
