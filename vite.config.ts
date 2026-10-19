import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Декодеры pdf.js для сканов (JBIG2, JPEG 2000) и цветовых профилей. pdf.js
 * берёт их по адресу папки, а не импортом, поэтому кладём их в сборку как есть.
 */
const PDFJS_WASM_DIR = fileURLToPath(new URL('./node_modules/pdfjs-dist/wasm', import.meta.url));
const PDFJS_WASM_FILES = [
  'jbig2.wasm',
  'openjpeg.wasm',
  'qcms_bg.wasm',
  'jbig2_nowasm_fallback.js',
  'openjpeg_nowasm_fallback.js',
];

function pdfjsWasm(): Plugin {
  return {
    name: 'pdfjs-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = req.url?.match(/\/pdfjs\/wasm\/([\w.]+)(?:\?|$)/)?.[1];
        if (!file || !PDFJS_WASM_FILES.includes(file)) return next();
        res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.end(readFileSync(resolve(PDFJS_WASM_DIR, file)));
      });
    },
    generateBundle() {
      for (const file of PDFJS_WASM_FILES) {
        this.emitFile({
          type: 'asset',
          fileName: `pdfjs/wasm/${file}`,
          source: readFileSync(resolve(PDFJS_WASM_DIR, file)),
        });
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), pdfjsWasm()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
