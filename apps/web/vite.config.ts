import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// dev 期 proxy → server（01 §4.1 构建行；M5 live 数据源同源化——cookie 会话
// 与 SSE 免 CORS）。目标 = server 默认端口 8787（apps/server/src/config.ts，
// PORT env 可覆写两侧）。parity/preview 形态不经 proxy（静态托管/fixture）。
export default defineConfig({
  plugins: [react()],
  server: {
    // watch 排除 .claude/**——并行 agent worktree 落在仓内任意深度的
    // .claude/worktrees/ 时,其 pnpm install/构建动静会触发 vite 全量重载
    // 风暴把 dev 拖死(实证 2026-09-24:嵌套 worktree 引发 reload 刷屏)。
    watch: { ignored: ['**/.claude/**'] },
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.PACMAN_DEV_SERVER_PORT ?? 8787}`,
        changeOrigin: true,
      },
      '/git': {
        target: `http://127.0.0.1:${process.env.PACMAN_DEV_SERVER_PORT ?? 8787}`,
        changeOrigin: true,
      },
    },
  },
});
