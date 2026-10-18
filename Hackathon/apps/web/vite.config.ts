import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The web app is a pure client. Analysis, scenarios and AI reports are served
// by apps/api; in development /v1 (HTTP and the live WebSocket) is proxied to it.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:3000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/v1': { target: apiTarget, ws: true, changeOrigin: true },
      },
    },
    preview: {
      proxy: {
        '/v1': { target: apiTarget, ws: true, changeOrigin: true },
      },
    },
  }
})
