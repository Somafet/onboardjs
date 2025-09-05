'use client'

import { useState, useCallback } from 'react'
import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import { WaypointsIcon, GitBranchIcon, ArrowRightIcon, XIcon } from 'lucide-react'

interface ConditionalFlowModeProps<TContext extends OnboardingContext = OnboardingContext> {
    steps: OnboardingStep<TContext>[]
    onStepsChange: (steps: OnboardingStep<TContext>[]) => void
    isActive: boolean
    onToggle: () => void
    defaultCondition?: (context: TContext) => boolean
    readonly?: boolean
}

export function ConditionalFlowMode<TContext extends OnboardingContext = OnboardingContext>({
    steps,
    onStepsChange,
    isActive,
    onToggle,
    defaultCondition,
    readonly = false,
}: ConditionalFlowModeProps<TContext>) {
    const [selectedSourceStep, setSelectedSourceStep] = useState<string | null>(null)
    const [selectedTargetSteps, setSelectedTargetSteps] = useState<string[]>([])

    const handleSourceStepSelect = useCallback(
        (stepId: string) => {
            if (readonly) return

            setSelectedSourceStep(stepId)
            setSelectedTargetSteps([])
        },
        [readonly]
    )

    const handleTargetStepToggle = useCallback(
        (stepId: string) => {
            if (readonly) return

            setSelectedTargetSteps((prev) =>
                prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId]
            )
        },
        [readonly]
    )

    const createConditionalBranch = useCallback(() => {
        if (readonly || !selectedSourceStep || selectedTargetSteps.length === 0) return

        const updatedSteps = steps.map((step) => {
            if (step.id === selectedSourceStep) {
                // Clear existing nextStep to enable conditional branching
                return {
                    ...step,
                    nextStep: undefined,
                }
            }
            return step
        })

        // Ensure target steps have appropriate conditions
        const finalSteps = updatedSteps.map((step) => {
            if (selectedTargetSteps.includes(String(step.id))) {
                // If step doesn't have a condition, add a placeholder
                if (!step.condition) {
                    return {
                        ...step,
                        condition: (defaultCondition ||
                            ((context: OnboardingContext) => {
                                // Default condition - customize this as needed
                                return context.flowData?.userRole === 'default' || false
                            })) as any,
                    }
                }
            }
            return step
        })

        onStepsChange(finalSteps)

        // Reset selection
        setSelectedSourceStep(null)
        setSelectedTargetSteps([])
    }, [readonly, selectedSourceStep, selectedTargetSteps, steps, onStepsChange])

    const reset = useCallback(() => {
        setSelectedSourceStep(null)
        setSelectedTargetSteps([])
    }, [])

    if (!isActive) {
        return (
            <button
                onClick={onToggle}
                disabled={readonly}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="Conditional Flow Mode"
            >
                <GitBranchIcon className="w-4 h-4" />
                Condition Builder
            </button>
        )
    }

    return (
        <div className="conditional-flow-mode border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <GitBranchIcon className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">Conditional Flow Mode</h3>
                </div>
                <button onClick={onToggle} className="p-1 text-blue-600 hover:text-blue-800 transition-colors">
                    <XIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Instructions */}
            <div className="mb-4 p-3 bg-white border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800 mb-2">
                    <strong>How to create conditional branches:</strong>
                </p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Select a source step (the step that will branch)</li>
                    <li>Select one or more target steps (conditional destinations)</li>
                    <li>Click "Create Branch" to establish conditional connections</li>
                    <li>Edit each target step to set up proper conditions</li>
                </ol>
            </div>

            {/* Step Selection */}
            <div className="space-y-4">
                {/* Source Step */}
                <div>
                    <label className="block text-sm font-medium text-blue-900 mb-2">1. Select Source Step:</label>
                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                        {steps.map((step) => (
                            <button
                                key={step.id}
                                onClick={() => handleSourceStepSelect(String(step.id))}
                                disabled={readonly}
                                className={`p-2 text-left border rounded-md transition-colors text-sm disabled:opacity-50 ${
                                    selectedSourceStep === String(step.id)
                                        ? 'border-blue-500 bg-blue-100 text-blue-900'
                                        : 'border-gray-300 bg-white hover:bg-gray-50'
                                }`}
                            >
                                <div className="font-medium">{String(step.id)}</div>
                                <div className="text-xs text-gray-600">
                                    {step.payload?.title || `${step.type || 'INFORMATION'} Step`}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Target Steps */}
                {selectedSourceStep && (
                    <div>
                        <label className="block text-sm font-medium text-blue-900 mb-2">
                            2. Select Target Steps (conditional destinations):
                        </label>
                        <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                            {steps
                                .filter((step) => String(step.id) !== selectedSourceStep)
                                .map((step) => (
                                    <button
                                        key={step.id}
                                        onClick={() => handleTargetStepToggle(String(step.id))}
                                        disabled={readonly}
                                        className={`p-2 text-left border rounded-md transition-colors text-sm disabled:opacity-50 ${
                                            selectedTargetSteps.includes(String(step.id))
                                                ? 'border-green-500 bg-green-100 text-green-900'
                                                : 'border-gray-300 bg-white hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium">{String(step.id)}</div>
                                                <div className="text-xs text-gray-600">
                                                    {step.payload?.title || `${step.type || 'INFORMATION'} Step`}
                                                </div>
                                            </div>
                                            {typeof step.condition === 'function' && (
                                                <div className="text-xs text-blue-600">Has Condition</div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                {selectedSourceStep && selectedTargetSteps.length > 0 && (
                    <div className="flex gap-2 pt-2 border-t border-blue-200">
                        <button
                            onClick={createConditionalBranch}
                            disabled={readonly}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <ArrowRightIcon className="w-4 h-4" />
                            Create Branch ({selectedTargetSteps.length} targets)
                        </button>
                        <button
                            onClick={reset}
                            className="px-4 py-2 border border-blue-300 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
                        >
                            Reset
                        </button>
                    </div>
                )}
            </div>

            {/* Current Selection Summary */}
            {(selectedSourceStep || selectedTargetSteps.length > 0) && (
                <div className="mt-4 p-3 bg-white border border-blue-200 rounded-md">
                    <div className="text-sm">
                        {selectedSourceStep && (
                            <div className="mb-1">
                                <strong>Source:</strong> {selectedSourceStep}
                            </div>
                        )}
                        {selectedTargetSteps.length > 0 && (
                            <div>
                                <strong>Targets:</strong> {selectedTargetSteps.join(', ')}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
