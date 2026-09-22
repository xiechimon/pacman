import { defineConfig } from 'vitest/config';

// 集成面跑真 pi 会话（本机 stub provider），时标放宽。
export default defineConfig({
  test: {
    testTimeout: 180_000,
    hookTimeout: 120_000,
  },
});
