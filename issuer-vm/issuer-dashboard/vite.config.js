// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'
// import wasm from 'vite-plugin-wasm'
// import topLevelAwait from 'vite-plugin-top-level-await'

// // https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [
//     react(),
//     wasm(),
//     topLevelAwait()
//   ],
// })  



import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait()
  ],
  server: {
    headers: {
      // Allow CSP for Wasm components
      'Content-Security-Policy': "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      // Allow blob workers (Vite dev uses blob workers for HMR & wasm)
      'Worker-Allowed': '*',
      'worker-src': "'self' blob:",
    },
  },
})
