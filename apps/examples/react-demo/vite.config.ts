import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
        // Exclude workspace packages from pre-bundling (monorepo development only)
        // Remove this if using standalone outside the monorepo
        exclude: ['@onboardjs/core', '@onboardjs/react', '@onboardjs/posthog-plugin'],
    },
})
