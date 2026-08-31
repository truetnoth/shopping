import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base приходит из workflow: на GitHub Pages сайт живёт по адресу
// https://<user>.github.io/<repo>/, а локально — в корне.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
})
