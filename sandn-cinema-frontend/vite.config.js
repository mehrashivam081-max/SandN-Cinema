import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/', // 👈 YEH EKDUM AISA HONA CHAHIYE (Purana SandN-Cinema hata do)
  plugins: [react()],
})