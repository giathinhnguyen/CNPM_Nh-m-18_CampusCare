import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // Docker bind mounts on Windows may not deliver file change events.
      usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
      interval: 500,
    },
  },
})
