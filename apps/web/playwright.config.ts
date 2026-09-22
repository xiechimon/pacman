import { defineConfig } from '@playwright/test';

// Issue #75 AC3: the reject-loop interaction chain walks client-side over
// the fixture script (`?scenario=chain`), so the e2e runs against the same
// parity-mode build the pixel harness uses — the only production-grade
// build in which the scenario parameter stays live (#58 gate).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8399',
    viewport: { width: 1440, height: 732 },
  },
  webServer: {
    command: 'pnpm exec vite build --mode parity && pnpm exec vite preview --host 127.0.0.1 --port 8399 --strictPort',
    url: 'http://127.0.0.1:8399/app',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
