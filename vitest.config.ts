import { defineConfig } from 'vitest/config';

// Root aggregation for the per-package colocated test/ dirs (01-stack-v2 §4.5:
// vitest projects mode). Only packages/* for now — apps gain test dirs as the
// backend milestones land.
export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
});
