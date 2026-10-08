import { defineConfig } from 'vitest/config';

// apps/web unit tests live in test/ (i18n coverage + PWA, #74). The
// Playwright e2e specs under e2e/ stay out of vitest — they run via
// `pnpm --filter @pacman/web e2e` (issue #75 AC3).
export default defineConfig({
  // @/* 别名镜像 vite.config.ts（#425）：registry 件 field.tsx 用它引
  // label/separator，任何 render 到该件的单测（如经 agent-detail 链拉进
  // create-provider-dialog 的 chief-identity）都要靠这里解析，缺则报
  // Cannot find package '@/components/ui/label.js'。
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
