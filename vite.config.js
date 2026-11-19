import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Production writes only when Vercel positively identifies production.
  // Preview, local and unlabelled builds fail closed.
  define: {
    __TENIO_READ_ONLY_PREVIEW__: JSON.stringify(process.env.VERCEL_ENV !== 'production'),
  },
})
