/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const _root = fileURLToPath(new URL('.', import.meta.url));
const _wasmMock = resolve(_root, 'src/__mocks__/pkg/core_wasm.ts');

export default defineConfig({
    plugins: [
        react(),
        {
            name: 'wasm-test-mock',
            enforce: 'pre',
            resolveId(source) {
                if (source.endsWith('/pkg/core_wasm') || source.endsWith('/pkg/core_wasm.js')) {
                    return _wasmMock;
                }
            },
        },
    ],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/__tests__/setup.ts'],
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        css: false,
    },
});
