import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            // Resolve the headless core to source in tests so React (and the
            // OnboardingContext singleton) are shared with the test runtime,
            // rather than loading a separately-bundled copy from dist.
            '@onboardjs/react-core': path.resolve(__dirname, '../react-core/src/index.ts'),
        },
        // Force a single React instance — the aliased core source would otherwise
        // resolve react from react-core's own node_modules, yielding a null dispatcher.
        dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test-setup.ts'],
        coverage: {
            provider: 'v8',
            exclude: [
                'src/**/index.ts', // Exclude all barrel index.ts files
                'dist/**', // Exclude the dist directory
                '*.config.ts', // Exclude config files
                'src/test-setup.ts', // Exclude test setup
                '**/*.test.{ts,tsx}', // Exclude test files
                // Exclude config.mjs files
                '*.config.mjs',
            ],
            reporter: ['text', 'html', 'clover'],
        },
    },
})
