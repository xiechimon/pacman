# #866 T5 命令闸 tracer —— 验证记录

## 改了什么

- `packages/shared/src/records/permission-rules.ts`：规则表形状（allow/ask/reject、
  首命中胜出、默认放行）+ 通用 glob 匹配器（AMP 式可编程策略层）。
- `apps/daemon/src/backend/command-gate.ts`：bash 裁决（自带表整串 glob 优先，
  默认不可逆形态分段 token 判定：rm 到根/家目录、mkfs、dd 写块设备、fork 炸弹、
  关机/重启）+ 门控 operations（ask/reject 抛拒绝，allow 原样委托）。
- `apps/daemon/src/backend/pi.ts`：门控 bash 以同名 customTool 覆盖内建 bash；
  `machine-loop.ts` + `log.ts`：`[gate]` 审计行（只记非放行，allow 静默）。
- `packages/shared/src/protocol/executor.ts`：`DAEMON_LOG_PREFIXES` +1（`gate`）。

## 实物（机制生效证据）

- `gate-probe.log`：真实 pi 栈探针（一次性脚本，输出归档、脚本不提交）——
  `echo hello-gate-probe` 真执行（exit 0）；`rm -rf /` 真被拒（`ask-rm-rf-root`，
  机身无损）；`session.getToolDefinition('bash') === 门控定义`（同名覆盖活体证明）；
  落盘一行 `[gate] ask: rule=ask-rm-rf-root command=rm -rf /`。
- 单元：daemon 413/413、shared 273/273（含新增 `command-gate.test.ts` 41、
  `permission-rules.test.ts` 11，均先于实现编写）。
- 集成：20 文件 / 59 测试全绿（`[gate]` 为加法行、allow 静默，无 canon 回归）。
- e2e：`e2e:affected` 判本次无 web 面（输出见下），覆盖由集成层承担。

## e2e:affected 输出（verbatim）

```
[e2e:affected] no web e2e surface touched — the stack layer (vitest integration) is the coverage for this change.
```

## 已知缺口（tracer 不覆盖，见 PR body）

- claude-code 后端仍 `bypassPermissions`（钩子在 bypass 下是否触发未验证）。
- 防误不防恶：变量展开/转义/编码绕行不在射程内。
- ask 在无人值守 daemon 按拒执行；审批面（web UI）上线后 ask 转人工。
