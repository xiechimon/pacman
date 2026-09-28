import { defineConfig } from 'vitest/config';

// 集成面跑真 pi 会话（本机 stub provider），时标放宽。
export default defineConfig({
  test: {
    testTimeout: 180_000,
    hookTimeout: 120_000,
    // 文件串行（#349）：多个集成文件各自 spawn `vite build` 写**同一个**
    // apps/web/dist，而 vite build 会先清空产物目录——默认的文件并行下它们
    // 互相清空，表现为间歇性的「web dist missing at apps/web/dist」假红（同一
    // 文件单独跑必过）。集成面本就重且状态化（真栈 + 固定端口 + 共享 dist），
    // 串行是它的正确默认值，不是性能妥协。
    fileParallelism: false,
  },
});
