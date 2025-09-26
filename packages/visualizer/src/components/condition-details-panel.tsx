import { useCallback } from 'react'
import { XIcon, GitBranchIcon } from 'lucide-react'
import { ConditionBuilder } from './condition-builder'
import { EnhancedConditionNode } from '../types/flow-types'

interface ConditionDetailsPanelProps {
    conditionNode: EnhancedConditionNode | null
    onUpdate: (updatedNode: EnhancedConditionNode) => void
    onClose: () => void
    readonly?: boolean
}

export function ConditionDetailsPanel({
    conditionNode,
    onUpdate,
    onClose,
    readonly = false,
}: ConditionDetailsPanelProps) {
    const handleSave = useCallback(
        (conditionDataUpdate: Partial<EnhancedConditionNode['data']>) => {
            if (!conditionNode || readonly) return

            const updatedNode: EnhancedConditionNode = {
                ...conditionNode,
                data: {
                    ...conditionNode.data,
                    ...conditionDataUpdate,
                },
            }

            onUpdate(updatedNode)
        },
        [conditionNode, onUpdate, readonly]
    )

    if (!conditionNode) return null

    return (
        <div className="condition-details-panel vis:bg-white vis:border-l vis:border-gray-200 vis:vis:w-108 vis:h-full vis:overflow-y-auto vis:flex vis:flex-col">
            {/* Header */}
            <div className="vis:flex vis:items-center vis:justify-between vis:p-4 vis:border-b vis:border-gray-200">
                <div className="vis:flex vis:items-center vis:gap-2">
                    <GitBranchIcon className="vis:w-5 vis:h-5 vis:text-indigo-600" />
                    <h2 className="vis:font-semibold vis:text-gray-900">Condition Details</h2>
                </div>
                <button
                    onClick={onClose}
                    className="vis:p-1 hover:vis:bg-gray-100 vis:rounded-md vis:transition-colors"
                >
                    <XIcon className="vis:w-5 vis:h-5" />
                </button>
            </div>

            {/* Content */}
            <div className="vis:flex-1 vis:p-4 vis:space-y-6">
                <ConditionBuilder
                    condition={conditionNode.data.condition}
                    onConditionChange={(condition) => handleSave({ condition })}
                    readonly={readonly}
                />

                {/* Branch Info */}
                <div className="vis:bg-gray-50 vis:p-4 vis:rounded-lg">
                    <h3 className="vis:font-medium vis:text-gray-900 vis:mb-3">Branch Information</h3>
                    <div className="vis:space-y-3">
                        <div className="vis:flex vis:items-center vis:gap-3">
                            <div className="vis:w-4 vis:h-4 vis:bg-green-500 vis:rounded"></div>
                            <span className="vis:text-sm vis:text-gray-700">
                                <strong>Then branch:</strong> Path when condition is true
                            </span>
                        </div>
                        <div className="vis:flex vis:items-center vis:gap-3">
                            <div className="vis:w-4 vis:h-4 vis:bg-red-500 vis:rounded"></div>
                            <span className="vis:text-sm vis:text-gray-700">
                                <strong>Else branch:</strong> Path when condition is false
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
