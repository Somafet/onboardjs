import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
    plugins: [],
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            name: 'OnboardJSCore',
            fileName: (format) => `index.${format}.js`,
            formats: ['es', 'cjs'],
        },
    },
})
