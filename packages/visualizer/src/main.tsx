import React from 'react'
import ReactDOM from 'react-dom/client'
import { FlowVisualizer } from './flow-visualizer'
import { OnboardingStep } from '@onboardjs/core'
import { ConditionParser } from './parser/condition-parser/condition-parser'

const initialSteps: OnboardingStep[] = [
    {
        id: 'step-1',
        nextStep: (context) => {
            const age = context.flowData?.age
            if (age >= 18 || age <= 65) {
                return 'step-2'
            }

            return null
        },
    },
    {
        id: 'step-2',
        nextStep: (context) => (context.flowData?.wantsNewsletter ? 'step-3' : null),
    },

    { id: 'step-3' },
]

const parser = new ConditionParser()

console.info('parseResult step-1', parser.parseConditions(initialSteps[0].nextStep!))
console.info('parseResult step-2', parser.parseConditions(initialSteps[1].nextStep!))

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <div style={{ height: '100vh', width: '100vw' }}>
            <FlowVisualizer initialSteps={initialSteps} />
        </div>
    </React.StrictMode>
)
