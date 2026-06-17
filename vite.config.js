import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { reactClickToComponent } from 'vite-plugin-react-click-to-component'

export default defineConfig({
  plugins: [react(), reactClickToComponent()],
  server: {
    port: 5173,
    cors: true,
  },
})
