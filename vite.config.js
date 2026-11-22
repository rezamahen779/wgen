import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // 🟢 1. TARUH PROXY DI SINI (Biar localhost:5173 nembak API Vercel bebas CORS!)
  server: {
    proxy: {
      '/api': {
        target: 'https://wgen-psi.vercel.app',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  base: '', // Tetap dipertahankan sesuai settingan aman kamu
  build: {
    // Menaikkan batas limit warning dari 1000 kB ke 2000 kB (opsional agar terminal bersih)
    chunkSizeWarningLimit: 2000, 
    
    // ==========================================
    // LANGKAH 3: PENGATURAN MANUAL CHUNKS (Rollup)
    // ==========================================
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Memisahkan library pihak ketiga (node_modules) agar terpecah dari file kode utama kamu
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // Library lainnya masuk ke vendor umum
            return 'vendor';
          }
        },
      },
    },
  },
})