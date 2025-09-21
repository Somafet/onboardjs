import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { GitBranchIcon } from 'lucide-react'
import { ConditionNodeType } from '../types/node-types'

export const ConditionNode = memo(({ data, selected }: NodeProps<ConditionNodeType>) => {
    const { description, errors = [] } = data

    return (
        <div
            className={`
        condition-node vis:px-4 vis:py-3 vis:shadow-lg vis:rounded-lg vis:border-2 vis:min-w-[250px] vis:max-w-[350px]
        ${errors.length > 0 ? 'vis:border-red-500 vis:bg-red-50' : 'vis:border-indigo-500 vis:bg-indigo-50'}
        ${selected ? 'vis:ring-2 vis:ring-indigo-500 vis:ring-opacity-50' : ''}
      `}
        >
            {/* Input Handle */}
            <Handle type="target" position={Position.Top} className="vis:size-3 vis:border-2 vis:bg-white" />

            {/* Header */}
            <div className="vis:space-x-2 vis:pb-2 vis:border-b vis:border-indigo-200">
                <GitBranchIcon className="vis:size-4 vis:text-indigo-600 vis:inline-block" />
                <span className="vis:font-semibold vis:text-sm vis:text-indigo-700">Condition</span>
            </div>

            {/* Condition Details */}
            <div className="vis:bg-indigo-100 vis:p-1 vis:rounded vis:my-2">
                {description ? (
                    <p className="vis:text-sm vis:text-indigo-700">{description}</p>
                ) : (
                    <p className="vis:text-sm vis:text-indigo-500">No description provided</p>
                )}
            </div>

            {/* Branch Labels and Handles */}
            <div className="vis:flex vis:justify-between vis:items-center">
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="then"
                    className="vis:w-3 vis:h-3 vis:border-2 vis:bg-green-500"
                    style={{ left: '25%' }}
                />

                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="else"
                    className="vis:w-3 vis:h-3 vis:border-2 vis:bg-red-500"
                    style={{ left: '75%' }}
                />
            </div>

            {/* Errors */}
            {errors.length > 0 && (
                <div className="vis:mt-3 vis:p-2 vis:bg-red-100 vis:rounded vis:text-xs vis:text-red-700">
                    <div className="vis:font-medium">Errors:</div>
                    <ul className="vis:list-disc vis:list-inside">
                        {errors.slice(0, 2).map((error, index) => (
                            <li key={index} className="vis:truncate">
                                {error}
                            </li>
                        ))}
                    </ul>
                    {errors.length > 2 && <div className="vis:text-center">+ {errors.length - 2} more</div>}
                </div>
            )}
        </div>
    )
})

ConditionNode.displayName = 'ConditionNode'
