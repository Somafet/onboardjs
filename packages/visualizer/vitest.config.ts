import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
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
