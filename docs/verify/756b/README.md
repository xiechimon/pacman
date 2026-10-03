# #756 第二轮：搜索框不常驻（typeahead-only）验收

契约：开面零搜索占位（不渲染）→ 可打印字符现形（吃掉该字符、预填、
即刻过滤、焦点进 input）→ 清空收回（框消失、清单回全量、焦点回清单）。

## Shots（fixture 面，e2e 同款步骤 manual capture）

- `drawer-open-no-box.png` — 抽屉 picker 开面：无 `.chief-pick-search`。
- `drawer-reveal-empty.png` — 键 `n`：框现形预填 `n` + 默认行 + 空态
  （fixture 面 modelOptions 缺省，drawer 面恒无候选）。
- `settings-reveal-filter.png` — 压缩 picker 键 `c`：框预填 `c` + 默认行 +
  过滤出的 canon 行（claude-sonnet-5），无空态。

## Gates（本 worktree，2026-10-04）

- `pnpm -r typecheck` — clean（/tmp/t0122-typecheck.log）。
- `pnpm lint` (biome ci) — 0 errors, 11 warnings, 26 infos（/tmp/t0122-lint.log）。
- `pnpm --filter @pacman/web e2e:affected` — 首轮 139/140：drawer typeahead
  用例在首键处丢键；根因 = Base UI initialFocus 异步移入与首键竞态。
  修法 = ModelPickList 挂载即焦点进清单容器（`model-select-core.tsx`）。
  复跑 **140/140 green**（/tmp/t0122-e2e2.log）；typeahead 用例另 `--repeat-each=5` 全过。
