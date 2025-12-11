import { useOnboarding } from '@onboardjs/react'
import clsx from 'clsx'
import ThankYou from './thank-you'
import OnobardJsLogo from '../logo'
import { Suspense } from 'react'

const LogoComposition = (
    <a href="https://onboardjs.com" aria-label="OnboardJS Homepage" className="flex items-center gap-x-2 text-zinc-950">
        <OnobardJsLogo className="size-4" />
        <span className="text-sm font-semibold">OnboardJS</span>
    </a>
)

/**
 * Loading skeleton for step content
 */
function StepSkeleton() {
    return (
        <div className="w-full animate-pulse space-y-4">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
    )
}

/**
 * Loading skeleton for the entire onboarding UI
 */
function LoadingSkeleton() {
    return (
        <div className="flex w-full min-w-sm flex-col justify-center rounded-lg bg-white px-4">
            <div role="status" className="w-full animate-pulse space-y-4 py-8 sm:space-y-8">
                <div className="flex max-w-full items-center justify-center gap-x-4 overflow-hidden">
                    <div className="h-2 w-full rounded-full bg-gray-300"></div>
                    <div className="h-2 w-full rounded-full bg-gray-200"></div>
                    <div className="h-2 w-full rounded-full bg-gray-200"></div>
                </div>

                <div className="w-full rounded-lg border border-gray-200 p-4 py-6">
                    <div className="mb-2.5 h-3 w-24 rounded-full bg-gray-300"></div>
                    <div className="h-3 w-[80%] rounded-full bg-gray-200"></div>
                </div>

                <div className="w-full rounded-lg border border-gray-200 p-4 py-6">
                    <div className="mb-2.5 h-3 w-24 rounded-full bg-gray-300"></div>
                    <div className="h-3 w-[80%] rounded-full bg-gray-200"></div>
                </div>

                <div className="w-full rounded-lg border border-gray-200 p-4 py-6">
                    <div className="mb-2.5 h-3 w-24 rounded-full bg-gray-300"></div>
                    <div className="h-3 w-[80%] rounded-full bg-gray-200"></div>
                </div>
            </div>
            <div className="grow"></div>
            <div className="ml-auto pb-2">{LogoComposition}</div>
        </div>
    )
}

export default function OnboardingUI() {
    const { renderStep, currentStep, engine, state } = useOnboarding()

    if (!state) {
        // If the state is not initialized, show a loading state
        // This can happen if the onboarding engine is still initializing
        return <LoadingSkeleton />
    }

    if (state.isCompleted || !currentStep) {
        // If the onboarding process is completed or there is no current step anymore,
        // render the Thank You component
        return <ThankYou />
    }

    return (
        <div className="flex flex-col sm:min-w-sm divide-y divide-gray-200 overflow-hidden rounded-lg bg-white text-zinc-950 shadow-sm xl:max-w-none min-h-[600px]">
            <div className="px-4 py-6 sm:p-6 grow flex flex-col">
                {/* Progress tracker showing current step progress */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex w-full items-center gap-x-2">
                        {engine?.getRelevantSteps()?.map((_, index) => (
                            <span
                                key={index}
                                className={clsx(
                                    'h-2 w-full rounded-full transition-colors duration-200',
                                    index < state.currentStepNumber ? 'bg-blue-600' : 'bg-gray-300'
                                )}
                                aria-label={`Step ${index + 1} ${index < state.currentStepNumber ? 'completed' : 'pending'}`}
                            ></span>
                        ))}
                    </div>
                </div>

                {/* Step title and subtitle */}
                {currentStep?.meta?.title && (
                    <h2 className="mt-4 text-lg leading-6 font-medium text-gray-900">{currentStep.meta.title}</h2>
                )}
                {currentStep?.meta?.subtitle && (
                    <p className="mt-1 max-w-md text-sm text-gray-500">{currentStep.meta.subtitle}</p>
                )}

                {/* Render the current step content with Suspense boundary */}
                <div className="my-4 mb-6 sm:my-8">
                    <Suspense fallback={<StepSkeleton />}>{renderStep()}</Suspense>
                </div>

                {/* Spacer to push logo to bottom */}
                <div className="grow"></div>

                {/* OnboardJS branding */}
                <div className="ml-auto w-min">{LogoComposition}</div>
            </div>
        </div>
    )
}
