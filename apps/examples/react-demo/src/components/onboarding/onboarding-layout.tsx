import { OnboardingContainer } from '@onboardjs/react'
import OnboardingUI from './onboarding-ui'
import { steps } from './steps'
import { createPostHogPlugin } from '@onboardjs/posthog-plugin'
import posthog from 'posthog-js'

const posthogPlugin = createPostHogPlugin({
    posthogInstance: posthog,
    // We can enable debug logging during development
    debug: process.env.NODE_ENV === 'development',
    enableConsoleLogging: process.env.NODE_ENV === 'development',
})

/**
 * Custom error fallback UI
 */
function ErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
    return (
        <div className="flex flex-col sm:min-w-sm divide-y divide-gray-200 overflow-hidden rounded-lg bg-white text-zinc-950 shadow-sm xl:max-w-none min-h-[600px] p-6">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
                <div className="text-4xl">⚠️</div>
                <h2 className="text-lg font-semibold text-gray-900">Oops! Something went wrong</h2>
                <p className="text-sm text-gray-600 max-w-sm">{error.message}</p>
                <button
                    onClick={resetError}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Try Again
                </button>
            </div>
        </div>
    )
}

export default function OnboardingLayout() {
    return (
        <OnboardingContainer
            plugins={[posthogPlugin]}
            steps={steps}
            flowId="onboarding-flow"
            flowName="Onboarding Flow"
            flowVersion="1.0.0"
            initialContext={{ flowData: { onboardingType: 'developer' } }}
            // Enable error boundary for better error handling
            errorBoundary={true}
            errorBoundaryProps={{
                fallback: (props) => (
                    <ErrorFallback error={props.error.originalError || props.error} resetError={props.resetError} />
                ),
            }}
            // You can enable localStorage persistence by uncommenting:
            localStoragePersistence={{
                key: 'onboarding-flow',
                ttl: 1000 * 60 * 60 * 24, // 1 day
            }}
        >
            <div className="flex flex-col gap-4">
                <OnboardingUI />
            </div>
        </OnboardingContainer>
    )
}
