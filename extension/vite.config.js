import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import * as sass from 'sass';

const styleEntries = [
  {
    source: resolve(__dirname, 'styles/popup.scss'),
    output: resolve(__dirname, 'popup/popup.css')
  },
  {
    source: resolve(__dirname, 'styles/newtab.scss'),
    output: resolve(__dirname, 'newtab/newtab.css')
  },
  {
    source: resolve(__dirname, 'styles/content.scss'),
    output: resolve(__dirname, 'content/content.css')
  }
];

function compileExtensionStyles() {
  for (const entry of styleEntries) {
    const result = sass.compile(entry.source, { style: 'expanded' });
    mkdirSync(dirname(entry.output), { recursive: true });
    const banner = '/* Generated from extension/styles. Do not edit directly. */\n';
    writeFileSync(entry.output, banner + result.css);
  }
}

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup/popup.html'),
        newtab: resolve(__dirname, 'newtab/newtab.html'),
        background: resolve(__dirname, 'background/background.js'),
        content: resolve(__dirname, 'content/content.js')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        format: 'es'
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
      name: 'compile-extension-styles',
      buildStart() {
        compileExtensionStyles();
      },
      configureServer(server) {
        compileExtensionStyles();
        server.watcher.add(resolve(__dirname, 'styles'));
        server.watcher.on('change', (file) => {
          if (file.includes(`${resolve(__dirname, 'styles')}`)) {
            compileExtensionStyles();
          }
        });
      }
    },
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
