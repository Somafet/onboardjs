'use client'

import { useOnboarding } from '@onboardjs/react'
import { ReactNode } from 'react'

type StepLayoutProps = {
    children: ReactNode
    aside: ReactNode
}

export default function StepLayout({ children, aside }: StepLayoutProps) {
    const { next, previous, reset, state, currentStep } = useOnboarding()
    return (
        <>
            <main className="md:pl-72 py-8 w-full">
                <div className="xl:pr-126 h-full w-full">
                    <div className="px-4 py-10 sm:px-6 md:px-8 md:py-6 h-full flex flex-col w-full">
                        {children}
                        <div className="grow"></div>
                        <div className="mt-8 max-sm:px-6 flex w-full justify-end pb-32 gap-x-4">
                            {state?.canGoPrevious && (
                                <button className="btn-outline" onClick={() => previous()}>
                                    Back
                                </button>
                            )}

                            {!state?.isCompleted && currentStep && (
                                <button className="btn" onClick={() => next()}>
                                    Next
                                </button>
                            )}

                            {(state?.isCompleted || currentStep === null) && (
                                <button className="btn" onClick={() => reset()}>
                                    Reset Onboarding
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <aside className="fixed inset-y-0 right-0 hidden w-126 overflow-y-auto border-l px-4 sm:px-6 lg:px-8 xl:block py-8">
                <div className="px-4 py-10 sm:px-6 lg:px-8 lg:py-6">{aside}</div>
            </aside>
        </>
    )
}
