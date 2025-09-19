import { useCallback } from 'react'
import { ConditionNode } from '../nodes/condition-node'
import { XIcon, GitBranchIcon } from 'lucide-react'
import { ConditionBuilder } from './condition-builder'

interface ConditionDetailsPanelProps {
    conditionNode: ConditionNode | null
    onUpdate: (updatedNode: ConditionNode) => void
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
        (conditionDataUpdate: Partial<ConditionNode['data']>) => {
            if (!conditionNode || readonly) return

            const updatedNode: ConditionNode = {
                ...conditionNode,
                data: {
                    ...conditionNode.data,
                    ...conditionDataUpdate,
                },
            }

            console.log('Updated Condition Node:', updatedNode)

            onUpdate(updatedNode)
        },
        [conditionNode, onUpdate, readonly]
    )

    if (!conditionNode) return null

    return (
        <div className="condition-details-panel bg-white border-l border-gray-200 w-108 h-full overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <GitBranchIcon className="w-5 h-5 text-indigo-600" />
                    <h2 className="font-semibold text-gray-900">Condition Details</h2>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md transition-colors">
                    <XIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <textarea
                            value={conditionNode.data.description}
                            onChange={(e) => handleSave({ description: e.target.value })}
                            disabled={readonly}
                            placeholder="Enter condition description"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                        />
                    </div>
                </div>

                <ConditionBuilder
                    condition={conditionNode.data.condition}
                    onConditionChange={(condition) => handleSave({ condition })}
                    readonly={readonly}
                />

                {/* Branch Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-3">Branch Information</h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-green-500 rounded"></div>
                            <span className="text-sm text-gray-700">
                                <strong>Then branch:</strong> Path when condition is true
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-red-500 rounded"></div>
                            <span className="text-sm text-gray-700">
                                <strong>Else branch:</strong> Path when condition is false
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
