import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'OnboardJSMixpanelPlugin',
            formats: ['es', 'cjs'],
            fileName: (format) => `index.${format === 'es' ? 'es' : 'cjs'}.js`,
        },
        rollupOptions: {
            external: ['@onboardjs/core', 'mixpanel-browser', 'react', 'react-dom'],
            output: {
                globals: {
                    '@onboardjs/core': 'OnboardJSCore',
                    'mixpanel-browser': 'mixpanel',
                    react: 'React',
                    'react-dom': 'ReactDOM',
                },
            },
        },
    },
})
