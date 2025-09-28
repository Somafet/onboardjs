import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import preserveUseClientDirective from 'rollup-plugin-preserve-use-client'

export default defineConfig({
    plugins: [react(), tailwindcss(), preserveUseClientDirective()],
    // Development server configuration for better HMR
    server: {
        port: 3000,
        open: true, // Auto-open browser
        hmr: {
            overlay: true, // Show error overlay on HMR updates
        },
        // Watch additional files for changes
        watch: {
            usePolling: false, // Use native file system events
            interval: 100,
        },
    },
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'), // Entry point for library build
            name: 'OnboardJSVisualizer',
            fileName: (format) => `index.${format}.js`,
            formats: ['es', 'cjs'],
        },
        rollupOptions: {
            external: [
                'react',
                'react-dom',
                '@onboardjs/core', // This one is local!
                '@xyflow/react', // Needs import map entry
                'dagre', // Needs import map entry
                'lucide-react', // Needs import map entry
            ],
            output: {
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                    '@onboardjs/core': 'OnboardJSCore',
                    '@xyflow/react': 'XYFlowReact', // Keep consistency for CJS if needed
                    dagre: 'Dagre',
                    'lucide-react': 'LucideReact',
                },
            },
        },
        cssCodeSplit: true, // Crucial for CSS to be separate if you have one
    },
    // Ensure esbuild.wasm is copied to dist/public or served by dev server
    publicDir: 'public', // If you have esbuild.wasm here
    assetsInclude: ['**/*.wasm'], // Ensure .wasm files are handled
})
