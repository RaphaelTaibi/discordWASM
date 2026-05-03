import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Dedicated Vite build for the AudioWorklet.
 *
 * Why a separate config:
 *   AudioWorklet.addModule() loads an ES module that runs in the audio
 *   rendering thread. The browser walks its `import` graph at load time;
 *   any unresolved import aborts the whole thing with the opaque error
 *   `AbortError: Unable to load a worklet's module`.
 *
 *   The previous setup (`tsc --outDir public/worker`) preserved bare
 *   relative imports (`../pkg/core_wasm.js`, `./rnnoise-sync.js`) but
 *   never emitted those dependency files into `public/`. In production
 *   the worklet 404'd on its own imports, hence the AbortError.
 *
 *   This config bundles the worklet with Rollup (via Vite lib mode) into
 *   a single self-contained ESM file at `public/worker/noise-gate.worklet.js`.
 *   `inlineDynamicImports` flattens any code-split chunks into the same file
 *   so the worklet has zero external imports at runtime.
 *
 *   `emptyOutDir: false` prevents this build from wiping `public/`.
 */
export default defineConfig({
    build: {
        target: 'es2020',
        emptyOutDir: false,
        outDir: 'public/worker',
        minify: false,
        lib: {
            entry: resolve(__dirname, 'src/worker/noise-gate.worklet.ts'),
            formats: ['es'],
            fileName: () => 'noise-gate.worklet.js',
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
});
