import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
    if (mode === 'client') {
        // Client-side React app build
        return {
            plugins: [react()],
            root: 'src/client',
            build: {
                outDir: '../../dist/client',
                emptyOutDir: true,
                rollupOptions: {
                    input: 'src/client/index.html',
                },
            },
            server: {
                port: 3000,
            },
        }
    }

    // Default build for development
    return {
        plugins: [react()],
        root: 'src/client',
        server: {
            port: 3000,
        },
    }
})
