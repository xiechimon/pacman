import { defineConfig } from 'vitest/config';

// Root aggregation for the per-package colocated test/ dirs (01-stack-v2 §4.5:
// vitest projects mode). apps/web's test dir landed with #73 (dnd pure core).
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/server', 'apps/web'],
  },
});
