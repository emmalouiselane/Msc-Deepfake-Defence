import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';

export default defineConfig({
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'background/background.js'),
      output: {
        entryFileNames: 'background.js',
        format: 'es',
        inlineDynamicImports: true
      }
    },
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  plugins: [
    {
      name: 'copy-onnx-runtime',
      writeBundle() {
        const distDir = resolve(__dirname, 'dist');
        const runtimeDist = resolve(__dirname, 'node_modules/onnxruntime-web/dist');
        const ortSource = resolve(runtimeDist, 'ort.min.js');
        const ortWasmSource = resolve(runtimeDist, 'ort.wasm.min.js');

        mkdirSync(distDir, { recursive: true });

        if (existsSync(ortSource)) {
          copyFileSync(ortSource, resolve(distDir, 'ort.min.js'));
          console.log('Copied ONNX Runtime to dist/ort.min.js');
        } else {
          console.warn('ONNX Runtime not found at models/ort.min.js');
        }

        if (existsSync(ortWasmSource)) {
          copyFileSync(ortWasmSource, resolve(distDir, 'ort.wasm.min.js'));
          console.log('Copied ONNX WASM runtime to dist/ort.wasm.min.js');
        } else {
          console.warn('ONNX WASM runtime not found in node_modules');
        }

        if (existsSync(runtimeDist)) {
          for (const file of readdirSync(runtimeDist)) {
            if (file.endsWith('.wasm') || file.endsWith('.mjs')) {
              copyFileSync(resolve(runtimeDist, file), resolve(distDir, file));
            }
          }
          console.log('Copied ONNX runtime WASM assets to dist/');
        } else {
          console.warn('onnxruntime-web runtime assets not found in node_modules');
        }
      }
    }
  ]
});
