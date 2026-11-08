import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

//  SSO 网关地址：本地为 9080（三服务统一入口），生产由 nginx 同域转发
const target = process.env.VITE_SSO_TARGET || 'http://127.0.0.1:9080'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      // 微服务全部走网关，路径前缀只有 /api；保留 /actuator 便于健康检查
      '/api': { target, changeOrigin: true },
      '/actuator': { target, changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500
  }
})
