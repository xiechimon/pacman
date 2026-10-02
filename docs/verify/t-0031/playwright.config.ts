import { defineConfig } from '@playwright/test';

// t-0031 死 CSS 清理的像素同一性探针：同一脚本先后打 before(origin/main)
// 与 after(清理分支) 两套 fixture preview。第一次 --update-snapshots 把
// before 存成基准，第二次跑严格比对（maxDiffPixels: 0）——通过即证明
// 「删除的规则零渲染影响」。用完即删，不进仓。
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  snapshotDir: './snapshots',
  snapshotPathTemplate: '{snapshotDir}/{arg}{ext}',
  timeout: 60_000,
  expect: { toHaveScreenshot: { maxDiffPixels: 0 } },
  use: {
    baseURL: process.env.PROBE_BASE ?? 'http://127.0.0.1:8400',
    viewport: { width: 1440, height: 732 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  },
});
