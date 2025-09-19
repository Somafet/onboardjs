import { memo } from 'react'
import { Handle, Position, NodeProps, Node } from '@xyflow/react'
import { GitBranchIcon } from 'lucide-react'
import { ConditionGroup } from '../utils/conditon'

export type ConditionNode = Node<
    {
        conditionId: string | number
        condition?: ConditionGroup[]
        description?: string
        errors?: string[]
    },
    'conditionNode'
>

export const ConditionNode = memo(({ data, selected }: NodeProps<ConditionNode>) => {
    const { description, errors = [] } = data

    return (
        <div
            className={`
        condition-node px-4 py-3 shadow-lg rounded-lg border-2 min-w-[250px] max-w-[350px]
        ${errors.length > 0 ? 'border-red-500 bg-red-50' : 'border-indigo-500 bg-indigo-50'}
        ${selected ? 'ring-2 ring-indigo-500 ring-opacity-50' : ''}
      `}
        >
            {/* Input Handle */}
            <Handle type="target" position={Position.Top} className="w-3 h-3 border-2 bg-white" />

            {/* Header */}
            <div className="space-x-2 pb-2 border-b border-indigo-200">
                <GitBranchIcon className="size-4 text-indigo-600 inline-block" />
                <span className="font-semibold text-sm text-indigo-700">Condition</span>
            </div>

            {/* Condition Details */}
            <div className="bg-indigo-100 p-1 rounded my-2">
                {description ? (
                    <p className="text-sm text-indigo-700">{description}</p>
                ) : (
                    <p className="text-sm text-indigo-500">No description provided</p>
                )}
            </div>

            {/* Branch Labels and Handles */}
            <div className="flex justify-between items-center">
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="then"
                    className="w-3 h-3 border-2 bg-green-500"
                    style={{ left: '25%' }}
                />

                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="else"
                    className="w-3 h-3 border-2 bg-red-500"
                    style={{ left: '75%' }}
                />
            </div>

            {/* Errors */}
            {errors.length > 0 && (
                <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-700">
                    <div className="font-medium">Errors:</div>
                    <ul className="list-disc list-inside">
                        {errors.slice(0, 2).map((error, index) => (
                            <li key={index} className="truncate">
                                {error}
                            </li>
                        ))}
                    </ul>
                    {errors.length > 2 && <div className="text-center">+ {errors.length - 2} more</div>}
                </div>
            )}
        </div>
    )
})

ConditionNode.displayName = 'ConditionNode'
