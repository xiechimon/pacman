# #841 证据：总管抽屉输入框 `/` 补全

## 改了什么

- `apps/web/src/chief/chief-drawer.tsx`：抽屉 composer 接入 `#731` 的
  slash registry（`overlay/slash-commands.ts` + `overlay/composer-wire.ts`
  同一 hook 面，与 `detail/composer.tsx` 同源）。抽屉面无 AI 审核 / 停止
  句柄，`reviewAvailable` / `stopAvailable` 双 `false`，两条按 rule 47
  条件隐藏；菜单只剩 clear / attach / mention / help + 团队技能。
- `apps/web/src/overlay/composer-wire.ts`：`runBuiltin` 的 `clear`
  在清空输入后经全站 sonner 打一次 `已清空` 轻确认（attach / mention /
  review / stop / help 本就有可见落点，只有 clear 是静默的）。
- `apps/web/src/i18n/en.ts`：新增 `已清空: 'Cleared'`。
- `apps/web/e2e/chief-drawer-slash.spec.ts`：6 条（菜单构成与条件隐藏 /
  `/clear` 执行不外发 + toast / Tab 与无高亮 Enter / 行中字面 /
  `/help` 面板 / Esc 关菜单抽屉存活）。

## 复现（修前必现）

抽屉输入框键入 `/clear` 回车 → 正文 POST 到 chief 线程，起 chief 回合
「处理中」。修后：输入清空 + `已清空` toast，全程零 chief POST。

## GIF

`drawer-clear.gif`：抽屉内 `some draft` → `/clear` 菜单 → 高亮 → 回车 →
输入清空 + `已清空` toast（反馈帧）。`cleared-toast.png` 为反馈帧静帧。

## 测试

- 新 spec 6/6 绿；相邻面 `composer-slash` / `chief-composer-tools` /
  `composer-inline-mention` 47/47 绿。
- `e2e:affected`（受影响面全选）见 `/tmp/841-affected.log`，全绿。
- `vitest run test/i18n-coverage.test.ts test/completion.test.ts` 38/38。
- `biome ci` 三文件干净；`pnpm --filter @pacman/web typecheck` 干净。
