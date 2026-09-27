# A4-primitives：原语扩变体（Phase 4 域深收编的契约上游）

主线自留票（herdr 不派）：各 lane 报告的「原语表达不了」清单收敛于此，扩完 Phase 4 域收编才有可收的形态。

## 范围

- `apps/web/src/ui/button.tsx` + `button.css`
- `apps/web/src/ui/chip.tsx` + `chip.css`
- `apps/web/src/ui/input.tsx` + `input.css`（仅 ref 透传验证，无档位新增）

## 扩充内容（各 lane 报告的缺口逐项）

1. **Button icon variant**：无文字纯图标钮——`board-guide`（28×28）、`todo-card-branch`（13×16）、`board-column-collapse`（25×25）、`dlg-copy` / `new-task-close`（24×24）。形：正方盒 + text-tertiary 墨 + hover 增亮；无 padding/字号。
2. **Button quiet variant**：弱文字钮（`delete-confirm-cancel` 的 r7 25 canon：text-dim 无框）——区别于 text 变体（text 是 indigo 链接式）。
3. **Button danger :disabled**：降透明度而非换底色（`delete-confirm-delete:disabled` 现走本面 CSS）。
4. **Chip mini 尺寸**：14px 高（`search-row-chip`，r7 05b 实测），variant 色族不变。
5. **Input ref 透传验证**：React 19 ref-as-prop 是否已自动透传（`InputProps extends InputHTMLAttributes` 理论含 ref 位）；若否修之。
6. **明确不做**（记录裁决）：Input 不加 30/40 档——档位膨胀；`delete-confirm-input` 30px 紧凑形、`prj-new-input` 40px 表单族维持散写（Phase 4 若要收编再单独裁决）。

## 验证

- `pnpm lint && pnpm typecheck`、`PARITY_PORT=8396 pnpm parity`（原语纯新增，229/229 应零变化）
- 不加新单测（禁表演型单测）；原语行为由 Phase 4 收编后的 e2e 钉。

## 交付

- commit 格式：`web(a4-primitives): <subject>`；本票文件随基线 commit 供 Phase 4 票引用。
