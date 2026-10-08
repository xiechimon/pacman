import { defineConfig } from 'vitest/config';

// apps/web unit tests live in test/ (i18n coverage + PWA, #74). The
// Playwright e2e specs under e2e/ stay out of vitest — they run via
// `pnpm --filter @pacman/web e2e` (issue #75 AC3).
export default defineConfig({
  // @/* 别名与 vite.config.ts 同源（#1008：registry alert-dialog.tsx 首个
  // 消费者上线后，vitest 的 node 解析面也要认得 @/——构建/e2e 走 vite.config
  // 早就认识，单元面此前零 @/ 依赖所以没配）。
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
