import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { env } from 'node:process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Production writes only when Vercel positively identifies production.
  // Preview, local and unlabelled builds fail closed.
  define: {
    __TENIO_READ_ONLY_PREVIEW__: JSON.stringify(env.VERCEL_ENV !== 'production'),
  },
})
