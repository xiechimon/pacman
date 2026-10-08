import { defineConfig } from 'vitest/config';

// apps/web unit tests live in test/ (i18n coverage + PWA, #74). The
// Playwright e2e specs under e2e/ stay out of vitest — they run via
// `pnpm --filter @pacman/web e2e` (issue #75 AC3).
export default defineConfig({
  // @/* 别名镜像 vite.config.ts（#425）：registry 件用它互引（field.tsx 引
  // label/separator、alert-dialog.tsx 引 button），任何 render 到这些件的
  // 单测（如经 agent-detail 链拉进 create-provider-dialog 的
  // chief-identity）都要靠这里解析，缺则报 Cannot find package
  // '@/components/ui/…'（#1008 独立复现于 alert-dialog 首消费者上线）。
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
