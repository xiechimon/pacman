import { defineConfig } from 'vitest/config';

// Root aggregation for the per-package colocated test/ dirs (01-stack-v2 §4.5:
// vitest projects mode). apps/web gains a test dir when its milestone lands.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/server'],
  },
});
