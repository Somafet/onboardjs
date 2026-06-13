// @onboardjs/react/src/components/StepNotFoundFallback.tsx
'use client'

import React from 'react'
import type { StepNotFoundInfo } from '@onboardjs/react-core'

export type { StepNotFoundInfo }

/**
 * Web (DOM) fallback shown when no component can be resolved for the active step.
 * Platform packages supply their own equivalent; the headless renderer stays UI-agnostic.
 */
export function StepNotFoundFallback({ stepId, attemptedKeys }: StepNotFoundInfo): React.ReactNode {
    return (
        <div style={{ padding: '16px', color: '#d32f2f', backgroundColor: '#ffebee', borderRadius: '4px' }}>
            <strong>❌ Component Not Found for Step: &quot;{stepId}&quot;</strong>
            <p style={{ marginTop: '8px', marginBottom: '0', fontSize: '14px' }}>
                OnboardJS tried to resolve a component from the registry but none of the following keys matched:
            </p>
            <ul style={{ marginTop: '4px', paddingLeft: '20px', marginBottom: '0' }}>
                {attemptedKeys.map((key) => (
                    <li key={key}>registry[&quot;{key}&quot;]</li>
                ))}
                <li>step.component property</li>
            </ul>
            <p style={{ marginTop: '8px', marginBottom: '0', fontSize: '13px' }}>
                Make sure the component is registered in the <code>componentRegistry</code> prop or defined directly in
                the step&apos;s <code>component</code> property.
            </p>
        </div>
    )
}
