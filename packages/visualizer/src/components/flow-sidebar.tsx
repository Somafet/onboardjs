'use client'

import { OnboardingStep, OnboardingContext, OnboardingStepType } from '@onboardjs/core'
import { PlusIcon, TrashIcon, XIcon } from 'lucide-react'

interface FlowSidebarProps<TContext extends OnboardingContext = OnboardingContext> {
    steps: OnboardingStep<TContext>[]
    onStepSelect: (step: OnboardingStep<TContext>) => void
    onStepAdd: (stepType?: OnboardingStepType) => void
    onStepDelete: (stepId: string | number) => void
    onClose: () => void
    readonly?: boolean
}

export function FlowSidebar<TContext extends OnboardingContext = OnboardingContext>({
    steps,
    onStepSelect,
    onStepAdd,
    onStepDelete,
    onClose,
    readonly = false,
}: FlowSidebarProps<TContext>) {
    return (
        <div className="flow-sidebar vis:bg-white vis:border-l vis:border-gray-200 vis:w-80 vis:h-full vis:overflow-hidden vis:flex vis:flex-col">
            {/* Header */}
            <div className="vis:flex vis:items-center vis:justify-between vis:p-4 vis:border-b vis:border-gray-200">
                <h2 className="vis:font-semibold vis:text-gray-900">Steps</h2>
                <button
                    onClick={onClose}
                    className="vis:p-1 hover:vis:bg-gray-100 vis:rounded-md vis:transition-colors"
                >
                    <XIcon className="vis:w-5 vis:h-5" />
                </button>
            </div>

            {/* Steps list */}
            <div className="vis:flex-1 vis:overflow-y-auto">
                {steps.length === 0 ? (
                    <div className="vis:p-4 vis:text-center vis:text-gray-500">
                        <p>No steps yet</p>
                        {!readonly && (
                            <button
                                onClick={() => onStepAdd()}
                                className="vis:mt-2 vis:text-blue-500 vis:hover:text-blue-600"
                            >
                                Add your first step
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="vis:p-2 vis:space-y-1">
                        {steps.map((step, index) => (
                            <div
                                key={step.id}
                                className="vis:group vis:flex vis:items-center vis:gap-2 vis:p-3 vis:rounded-lg vis:hover:bg-gray-50 vis:cursor-pointer vis:border vis:border-transparent vis:hover:border-gray-200"
                                onClick={() => onStepSelect(step)}
                            >
                                <div className="vis:flex-shrink-0 vis:size-8 vis:bg-blue-100 vis:text-blue-600 vis:rounded-full vis:flex vis:items-center vis:justify-center vis:text-sm vis:font-medium">
                                    {index + 1}
                                </div>

                                <div className="vis:flex-1 vis:min-w-0">
                                    <div className="vis:font-medium vis:text-sm vis:text-gray-900 vis:truncate">
                                        {getStepDisplayName(step)}
                                    </div>
                                    <div className="vis:text-xs vis:text-gray-500 vis:truncate">
                                        {step.type || 'INFORMATION'} • ID: {step.id}
                                    </div>
                                    {step.isSkippable && (
                                        <div className="vis:text-xs vis:text-yellow-600">Skippable</div>
                                    )}
                                </div>

                                {!readonly && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onStepDelete(step.id)
                                        }}
                                        className="vis:opacity-0 vis:group-hover:opacity-100 vis:p-1 vis:hover:bg-red-100 vis:text-red-500 vis:rounded vis:transition-all"
                                        title="Delete step"
                                    >
                                        <TrashIcon className="vis:size-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add button */}
            {!readonly && (
                <div className="vis:p-4 vis:border-t vis:border-gray-200">
                    <button
                        onClick={() => onStepAdd()}
                        className="vis:w-full vis:flex vis:items-center vis:justify-center vis:gap-2 vis:px-4 vis:py-2 vis:bg-blue-500 vis:text-white vis:rounded-md vis:hover:bg-blue-600 vis:transition-colors"
                    >
                        <PlusIcon className="vis:w-4 vis:h-4" />
                        Add Step
                    </button>
                </div>
            )}
        </div>
    )
}

function getStepDisplayName<TContext extends OnboardingContext = OnboardingContext>(
    step: OnboardingStep<TContext>
): string {
    const payload = step.payload as any

    if (payload?.title) return payload.title
    if (payload?.label) return payload.label
    if (payload?.question) return payload.question
    if (payload?.componentKey) return payload.componentKey

    return `Step ${step.id}`
}
