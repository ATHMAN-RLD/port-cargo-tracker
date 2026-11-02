import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // While developing, any request the website makes to /api is passed on
    // to the Django server. The browser thinks it is talking to one address,
    // so no cross-origin (CORS) setup is needed on the Django side.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
}) 