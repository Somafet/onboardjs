import React from 'react'
import ReactDOM from 'react-dom/client'
import { FlowVisualizer } from './flow-visualizer'
import { OnboardingStep } from '@onboardjs/core'

// Example initial steps for local dev
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

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <div style={{ height: '100vh', width: '100vw' }}>
            <FlowVisualizer
                initialSteps={sampleSteps}
                onStepsChange={(newSteps) => {
                    console.log('Steps changed in local dev:', newSteps)
                    // For dev, you might want to useState to see changes reflected
                    // or just keep it static if you're only testing import/export.
                    // For a simple test, just log:
                    // setSampleSteps(newSteps); // If sampleSteps was state
                }}
                onExport={(content, format, filename) => console.log(`Exported ${filename} (${format}):\n${content}`)}
            />
        </div>
    </React.StrictMode>
)
