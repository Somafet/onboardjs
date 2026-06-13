import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import preserveUseClientDirective from 'rollup-plugin-preserve-use-client'

export default defineConfig({
    plugins: [react(), preserveUseClientDirective()],
    build: {
        minify: 'esbuild',
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            name: 'OnboardJSReactNative',
            fileName: (format) => `index.${format}.js`,
            formats: ['es', 'cjs'],
        },
        rollupOptions: {
            external: [
                'react',
                'react/jsx-runtime',
                'react/jsx-dev-runtime',
                'react-native',
                '@react-native-async-storage/async-storage',
                '@onboardjs/core',
                '@onboardjs/react-core',
            ],
            treeshake: {
                moduleSideEffects: false,
                propertyReadSideEffects: false,
                tryCatchDeoptimization: false,
            },
            output: {
                exports: 'named',
            },
        },
    },
})
