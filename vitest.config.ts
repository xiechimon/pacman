import { defineConfig } from 'vitest/config';

// Root aggregation for the per-package colocated test/ dirs (01-stack-v2 §4.5:
// vitest projects mode). apps/web joined with the i18n/PWA ticket (#74).
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/server', 'apps/web'],
  },
});
