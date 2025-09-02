import React, { useState, useEffect } from 'react'
import { FlowVisualizer } from '@onboardjs/visualizer'
import { OnboardingStep } from '@onboardjs/core'

interface InitialData {
    steps: OnboardingStep[]
}

export default function App() {
    const [initialSteps, setInitialSteps] = useState<OnboardingStep[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Fetch initial data from server
        fetch('/api/initial-data')
            .then((res) => res.json())
            .then((data: InitialData) => {
                setInitialSteps(data.steps || [])
            })
            .catch((error) => {
                console.error('Failed to load initial data:', error)
                setInitialSteps([])
            })
            .finally(() => {
                setLoading(false)
            })
    }, [])

    const handleStepsChange = (steps: OnboardingStep[]) => {
        // Could save to server here if needed
        console.log('Steps changed:', steps.length, 'steps')
    }

    const handleExport = (content: string, format: string, filename: string) => {
        // Trigger download
        const blob = new Blob([content], {
            type: format === 'json' ? 'application/json' : 'text/typescript',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        // Also log for CLI
        console.log(`Exported ${filename}:`)
        console.log(content)
    }

    if (loading) {
        return (
            <div
                style={{
                    height: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                }}
            >
                Loading OnboardJS Visualizer...
            </div>
        )
    }

    return (
        <div style={{ height: '100vh', width: '100vw' }}>
            <FlowVisualizer initialSteps={initialSteps} onStepsChange={handleStepsChange} onExport={handleExport} />
        </div>
    )
}
