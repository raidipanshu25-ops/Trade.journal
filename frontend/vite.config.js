import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Gzip — serves .js.gz alongside every JS/CSS chunk
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,       // only compress files > 1 KB
      deleteOriginFile: false,
    }),
    // Brotli — even smaller (modern browsers prefer brotli over gzip)
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false,
    }),
  ],

  server: {
    port: 5173,
    strictPort: true,   // Never switch ports — keeps Google OAuth origins valid
    host: true,         // Expose on local network (0.0.0.0)
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },

  build: {
    // Use esbuild for minification (faster, smaller output)
    minify: 'esbuild',
    target: 'esnext',
    // Skip compressed-size reporting for faster builds
    reportCompressedSize: false,
    // Increase chunk warning threshold (recharts is legitimately large)
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split vendor chunks so React/Recharts/Markdown are cached
        // independently from your app code
        manualChunks: (id) => {
          // Core React runtime — tiny, frequently used, cache forever
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'react-core'
          }
          // React Router — changes rarely
          if (id.includes('node_modules/react-router')) {
            return 'react-router'
          }
          // Recharts + its D3 deps — biggest vendor chunk
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory-') ||
              id.includes('node_modules/internmap') ||
              id.includes('node_modules/robust-predicates')) {
            return 'recharts'
          }
          // React Markdown + remark/rehype ecosystem
          if (id.includes('node_modules/react-markdown') ||
              id.includes('node_modules/remark') ||
              id.includes('node_modules/rehype') ||
              id.includes('node_modules/unified') ||
              id.includes('node_modules/micromark') ||
              id.includes('node_modules/mdast') ||
              id.includes('node_modules/hast') ||
              id.includes('node_modules/vfile')) {
            return 'markdown'
          }
          // Google OAuth
          if (id.includes('node_modules/@react-oauth') ||
              id.includes('node_modules/google')) {
            return 'oauth'
          }
        },
      },
    },
  },
})
