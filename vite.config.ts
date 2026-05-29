import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/code-quest/',
  plugins: [react()],
  server: {
    // Port 9010 is whitelisted in the web-app's CSP for local PowerUp dev.
    // For standalone dev outside SchoolAI, any free port works fine.
    port: 9010,
    host: '127.0.0.1',
  },
})
