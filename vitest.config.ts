import { defineConfig } from 'vitest/config';

// Root aggregation for the per-package colocated test/ dirs (01-stack-v2 §4.5:
// vitest projects mode). apps/web joined with the i18n/PWA ticket (#74).
// integration/ = 跨端集成面（M3a demo/T2：server 派 step → daemon 真执行 →
// transcript 回传；三端互不依赖纪律不破——集成 harness 独立成包）。
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/server', 'apps/web', 'apps/daemon', 'integration'],
  },
});
