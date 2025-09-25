'use client'

import { useState, useEffect } from 'react'
import { XIcon } from 'lucide-react'
import { OptionsListEditor } from './option-list-editor'
import { ChecklistItemsEditor } from './checklist-item-editor'
import type { EnhancedStepNode, DeepPartial } from '../types'

interface StepDetailsPanelProps {
    node: EnhancedStepNode
    onNodeUpdate: (node: EnhancedStepNode) => void
    onClose: () => void
    readonly?: boolean
}

export function StepDetailsPanel({ node, onNodeUpdate, onClose, readonly = false }: StepDetailsPanelProps) {
    const [editedStep, setEditedStep] = useState<EnhancedStepNode>(node)
    const [hasChanges, setHasChanges] = useState(false)

    useEffect(() => {
        setEditedStep(node)
        setHasChanges(false)
    }, [node])

    const handleChange = (updates: DeepPartial<EnhancedStepNode>) => {
        const newStep = {
            ...editedStep,
            ...updates,
            data: {
                ...editedStep.data,
                ...updates.data,
            },
        } as EnhancedStepNode
        setEditedStep(newStep)
        setHasChanges(JSON.stringify(newStep) !== JSON.stringify(node))
    }

    const handleSave = () => {
        onNodeUpdate(editedStep)
        setHasChanges(false)
    }

    const handlePayloadChange = (payloadUpdates: any) => {
        handleChange({
            data: {
                ...editedStep.data,
                payload: {
                    ...(editedStep.data &&
                    typeof editedStep.data.payload === 'object' &&
                    editedStep.data.payload !== null
                        ? editedStep.data.payload
                        : {}),
                    ...payloadUpdates,
                },
            },
        })
    }

    return (
        <div className="step-details-panel vis:bg-white vis:border-l vis:border-gray-200 vis:w-108 vis:h-full vis:overflow-hidden vis:flex vis:flex-col">
            {/* Header */}
            <div className="vis:flex vis:items-center vis:justify-between vis:p-4 vis:border-b vis:border-gray-200">
                <h2 className="vis:font-semibold vis:text-gray-900">Step Details</h2>
                <button
                    onClick={onClose}
                    className="vis:p-1 hover:vis:bg-gray-100 vis:rounded-md vis:transition-colors"
                >
                    <XIcon className="vis:w-5 vis:h-5" />
                </button>
            </div>

            {/* Content */}
            <div className="vis:flex-1 vis:overflow-y-auto vis:p-4 vis:space-y-6">
                {/* Basic Info */}
                <div>
                    <h3 className="vis:font-medium vis:text-gray-900 vis:mb-3">Basic Information</h3>
                    <div className="vis:space-y-3">
                        <div>
                            <label className="vis:block vis:text-sm vis:font-medium vis:text-gray-700 vis:mb-1">
                                Step ID
                            </label>
                            <input
                                type="text"
                                value={editedStep.id}
                                onChange={(e) => handleChange({ id: e.target.value })}
                                disabled={readonly}
                                className="vis:w-full vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:disabled:bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="vis:block vis:text-sm vis:font-medium vis:text-gray-700 vis:mb-1">
                                Step Name
                            </label>
                            <input
                                type="text"
                                value={node.id}
                                onChange={(e) => handleChange({ id: e.target.value })}
                                disabled={readonly}
                                className="vis:w-full vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:disabled:bg-gray-50"
                            />
                        </div>

                        <div>
                            <label className="vis:block vis:text-sm vis:font-medium vis:text-gray-700 vis:mb-1">
                                Step Type
                            </label>
                            <select
                                value={editedStep.type || 'INFORMATION'}
                                onChange={(e) => handleChange({ type: e.target.value as any })}
                                disabled={readonly}
                                className="vis:w-full vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:disabled:bg-gray-50"
                            >
                                <option value="INFORMATION">Information</option>
                                <option value="SINGLE_CHOICE">Single Choice</option>
                                <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                                <option value="CHECKLIST">Checklist</option>
                                <option value="CONFIRMATION">Confirmation</option>
                                <option value="CUSTOM_COMPONENT">Custom Component</option>
                            </select>
                        </div>

                        <div>
                            <label className="vis:flex vis:items-center vis:gap-2">
                                <input
                                    type="checkbox"
                                    checked={editedStep.data.isSkippable || false}
                                    onChange={(e) => handleChange({ data: { isSkippable: e.target.checked } })}
                                    disabled={readonly}
                                />
                                <span className="vis:text-sm vis:font-medium vis:text-gray-700">Skippable</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Payload */}
                {editedStep.type && editedStep.data.type !== 'INFORMATION' && (
                    <div>
                        <h3 className="vis:font-medium vis:text-gray-900 vis:mb-3">Payload</h3>
                        <PayloadEditor
                            stepType={editedStep.type}
                            payload={editedStep.data.payload || {}}
                            onChange={handlePayloadChange}
                            readonly={readonly}
                        />
                    </div>
                )}

                {/* Navigation */}
                <div>
                    <h3 className="vis:font-medium vis:text-gray-900 vis:mb-3">Navigation</h3>
                    <div className="vis:space-y-3">
                        <div>
                            <label className="vis:block vis:text-sm vis:font-medium vis:text-gray-700 vis:mb-1">
                                Next Step ID
                            </label>
                            <input
                                type="text"
                                value={
                                    typeof editedStep.data.nextStep === 'function'
                                        ? '[Function]'
                                        : String(editedStep.data.nextStep || '')
                                }
                                onChange={(e) => handleChange({ data: { nextStep: e.target.value || undefined } })}
                                disabled={readonly || typeof editedStep.data.nextStep === 'function'}
                                placeholder="Auto (next in sequence)"
                                className="vis:w-full vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:disabled:bg-gray-50"
                            />
                        </div>

                        <div>
                            <label className="vis:block vis:text-sm vis:font-medium vis:text-gray-700 vis:mb-1">
                                Previous Step ID
                            </label>
                            <input
                                type="text"
                                value={
                                    typeof editedStep.data.previousStep === 'function'
                                        ? '[Function]'
                                        : String(editedStep.data.previousStep || '')
                                }
                                onChange={(e) =>
                                    handleChange({
                                        data: { previousStep: e.target.value || undefined },
                                    })
                                }
                                disabled={readonly || typeof editedStep.data.previousStep === 'function'}
                                placeholder="Auto (previous in sequence)"
                                className="vis:w-full vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:disabled:bg-gray-50"
                            />
                        </div>

                        {editedStep.data.isSkippable && (
                            <div>
                                <label className="vis:block vis:text-sm vis:font-medium vis:text-gray-700 vis:mb-1">
                                    Skip To Step ID
                                </label>
                                <input
                                    type="text"
                                    value={
                                        typeof editedStep.data.skipToStep === 'function'
                                            ? '[Function]'
                                            : String(editedStep.data.skipToStep)
                                    }
                                    onChange={(e) =>
                                        handleChange({
                                            data: { skipToStep: e.target.value || undefined },
                                        })
                                    }
                                    disabled={readonly || typeof editedStep.data.skipToStep === 'function'}
                                    placeholder="Auto (next step)"
                                    className="vis:w-full vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:disabled:bg-gray-50"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            {!readonly && hasChanges && (
                <div className="vis:border-t vis:border-gray-200 vis:p-4">
                    <div className="vis:flex vis:gap-2">
                        <button
                            onClick={handleSave}
                            className="vis:flex-1 vis:px-4 vis:py-2 vis:bg-blue-500 vis:text-white vis:rounded-md vis:hover:bg-blue-600 vis:transition-colors"
                        >
                            Save Changes
                        </button>
                        <button
                            onClick={() => {
                                setEditedStep(node)
                                setHasChanges(false)
                            }}
                            className="vis:px-4 vis:py-2 vis:border vis:border-gray-300 vis:text-gray-700 vis:rounded-md vis:hover:bg-gray-50 vis:transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// Payload editor component for different step types
function PayloadEditor({
    stepType,
    payload,
    onChange,
    readonly,
}: {
    stepType: string
    payload: any
    onChange: (updates: any) => void
    readonly: boolean
}) {
    switch (stepType) {
        case 'SINGLE_CHOICE':
        case 'MULTIPLE_CHOICE':
            return (
                <div className="vis:space-y-4">
                    <div>
                        <label className="vis:block vis:text-sm vis:font-medium vis:text-gray-700 vis:mb-1">
                            Data Key
                        </label>
                        <input
                            type="text"
                            value={payload.dataKey || ''}
                            onChange={(e) => onChange({ dataKey: e.target.value })}
                            disabled={readonly}
                            className="vis:w-full vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:disabled:bg-gray-50"
                        />
                    </div>
                    <OptionsListEditor
                        options={payload.options || []}
                        onChange={(newOptions) => onChange({ options: newOptions })}
                        readonly={readonly}
                    />
                </div>
            )

        case 'CHECKLIST':
            return (
                <div className="vis:space-y-4">
                    <div>
                        <label className="vis:block vis:text-sm vis:font-medium vis:text-gray-700 vis:mb-1">
                            Data Key
                        </label>
                        <input
                            type="text"
                            value={payload.dataKey || ''}
                            onChange={(e) => onChange({ dataKey: e.target.value })}
                            disabled={readonly}
                            className="vis:w-full vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:disabled:bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="vis:block vis:text-sm vis:font-medium vis:text-gray-700 vis:mb-1">
                            Min Items to Complete
                        </label>
                        <input
                            type="number"
                            value={payload.minItemsToComplete || ''}
                            onChange={(e) =>
                                onChange({
                                    minItemsToComplete: e.target.value ? parseInt(e.target.value) : undefined,
                                })
                            }
                            disabled={readonly}
                            className="vis:w-full vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:disabled:bg-gray-50"
                        />
                    </div>
                    <ChecklistItemsEditor
                        items={payload.items || []}
                        onChange={(newItems) => onChange({ items: newItems })}
                        readonly={readonly}
                    />
                </div>
            )

        case 'CUSTOM_COMPONENT':
            return (
                <div>
                    <label className="vis:block vis:text-sm vis:font-medium vis:text-gray-700 vis:mb-1">
                        Component Key
                    </label>
                    <input
                        type="text"
                        value={payload.componentKey || ''}
                        onChange={(e) => onChange({ componentKey: e.target.value })}
                        disabled={readonly}
                        className="vis:w-full vis:px-3 vis:py-2 vis:border vis:border-gray-300 vis:rounded-md vis:text-sm vis:disabled:bg-gray-50"
                    />
                </div>
            )

        default:
            return (
                <div className="vis:text-sm vis:text-gray-500">
                    No specific payload configuration for this step type
                </div>
            )
    }
}
