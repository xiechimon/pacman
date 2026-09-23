import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// dev 期 proxy → server（01 §4.1 构建行；M5 live 数据源同源化——cookie 会话
// 与 SSE 免 CORS）。目标 = server 默认端口 8787（apps/server/src/config.ts，
// PORT env 可覆写两侧）。parity/preview 形态不经 proxy（静态托管/fixture）。
export default defineConfig({
  plugins: [react()],
  server: {
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
