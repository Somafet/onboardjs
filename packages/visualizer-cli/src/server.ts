import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import cors from 'cors'
import { readFileSync, existsSync } from 'fs'
import { OnboardingStep } from '@onboardjs/core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const sampleSteps: OnboardingStep[] = [
    {
        id: 'start',
        type: 'INFORMATION',
        payload: { title: 'Local Dev Test' },
        nextStep: 'middle',
    },
    {
        id: 'middle',
        type: 'SINGLE_CHOICE',
        payload: { options: [{ id: 'a', label: 'A', value: 'a' }] },
        nextStep: 'end',
        condition(context) {
            return true === true // Always true for testing
        },
    },
    { id: 'end', type: 'CONFIRMATION', payload: { title: 'Finished' } },
]

interface ServerOptions {
    port: number
    host: string
    initialFile?: string
}

export async function startServer(options: ServerOptions) {
    const app = express()
    const clientDir = join(__dirname, 'client')

    // Middleware
    app.use(cors())
    app.use(express.json({ limit: '50mb' }))

    // Serve static files from the built client
    app.use(express.static(clientDir))

    // API endpoint to get initial data
    app.get('/api/initial-data', (req, res) => {
        if (options.initialFile && existsSync(options.initialFile)) {
            try {
                const data = readFileSync(options.initialFile, 'utf-8')
                const steps = JSON.parse(data)
                res.json({ steps })
            } catch (error) {
                console.warn(`⚠️ Could not load initial file ${options.initialFile}:`, error)
                res.json({ steps: [] })
            }
        } else {
            res.json({ steps: sampleSteps })
        }
    })

    // API endpoint to save data (optional)
    app.post('/api/save', (req, res) => {
        const { steps, format } = req.body
        // For now just log, could implement file saving later
        console.log(`💾 Save requested (${format}):`, steps.length, 'steps')
        res.json({ success: true })
    })

    // Catch-all handler for client-side routing
    app.get('*', (req, res) => {
        res.sendFile(join(clientDir, 'index.html'))
    })

    return new Promise<any>((resolve, reject) => {
        const server = app.listen(options.port, options.host, () => {
            resolve(server)
        })

        server.on('error', (error: any) => {
            if (error.code === 'EADDRINUSE') {
                reject(new Error(`Port ${options.port} is already in use`))
            } else {
                reject(error)
            }
        })
    })
}
