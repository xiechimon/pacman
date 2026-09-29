import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// dev 端口从 PACMAN_DEV_WEB_PORT 读（根 `pnpm dev` 注入 5300）。空串/非法值
// 回落 5173——与 server 侧 envPort 的「空串当未设」同律。
const devWebPort = Number(process.env.PACMAN_DEV_WEB_PORT) || 5173;

// dev 期 proxy → server（01 §4.1 构建行；M5 live 数据源同源化——cookie 会话
// 与 SSE 免 CORS）。目标端口 = PACMAN_DEV_SERVER_PORT，缺省 8787
// （apps/server/src/config.ts 的 PORT 缺省）。两侧同源注入，根 `pnpm dev`
// 一并对齐。preview 形态不经 proxy（静态托管/fixture）。
export default defineConfig({
  plugins: [react()],
  server: {
    port: devWebPort,
    // strictPort：vite 缺省「被占就静默 +1」在多栈并行下有两重害处——界面
    // 地址每次漂移，且 proxy 仍指向本栈 server 之外（界面实际驱动的是别人
    // 的栈）。撞端口即启动失败，换号走 PACMAN_DEV_WEB_PORT。
    strictPort: true,
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
