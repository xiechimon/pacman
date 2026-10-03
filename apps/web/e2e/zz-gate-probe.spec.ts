import { expect, test } from '@playwright/test';

// #762 probe spec. It exists on the throwaway `probe/762-gate-failure-path`
// branch only, so the aggregate gate's failure path can be read off a real CI
// run instead of inferred from the workflow source: one shard must go red and
// `e2e-gate` must report `failure` rather than being skipped.
test('#762 probe: this shard is red on purpose', () => {
  expect('gate').toBe('shut');
});