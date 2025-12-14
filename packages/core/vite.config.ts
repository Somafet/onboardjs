import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
    plugins: [],
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            name: 'OnboardJSCore',
            fileName: (format) => `index.${format}.js`,
        },
        rollupOptions: {
            output: [
                {
                    format: 'es',
                    exports: 'named',
                    preserveModules: false,
                },
                {
                    format: 'cjs',
                    exports: 'named',
                    preserveModules: false,
                    interop: 'compat',
                },
            ],
        },
    },
})
