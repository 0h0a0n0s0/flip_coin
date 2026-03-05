import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// Docker 內需用 api:3000；本機開發用 127.0.0.1:3000
const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:3000'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3001,
    host: '0.0.0.0', // Docker 中必須監聽 0.0.0.0
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.error('[Vite Proxy] API 代理錯誤:', err.message);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            if (proxyRes.statusCode >= 500) {
              console.warn(`[Vite Proxy] API 回傳 ${proxyRes.statusCode}:`, req?.url);
            }
          });
        }
      },
      '/socket.io': {
        target: apiTarget,
        ws: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    emptyOutDir: true
  }
})
