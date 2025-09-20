import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { OnboardingStepType } from '@onboardjs/core'
import { InfoIcon, CheckCircleIcon, ListIcon, HandIcon, ListChecksIcon, PuzzleIcon } from 'lucide-react'
import { StepNodeType, getStepTypeColor as getNodeTypeColor } from '../types/node-types'

// Re-export the type for backwards compatibility
export type StepNode = StepNodeType

export const StepNode = memo(({ data, selected }: NodeProps<StepNode>) => {
    const { stepType, label, description, isSkippable, hasCondition, isCompleted, errors = [] } = data

    const getStepIcon = (type: OnboardingStepType) => {
        const iconProps = { className: 'w-5 h-5' }

        switch (type) {
            case 'INFORMATION':
                return <InfoIcon {...iconProps} />
            case 'SINGLE_CHOICE':
                return <CheckCircleIcon {...iconProps} />
            case 'MULTIPLE_CHOICE':
                return <ListChecksIcon {...iconProps} />
            case 'CHECKLIST':
                return <ListIcon {...iconProps} />
            case 'CONFIRMATION':
                return <HandIcon {...iconProps} />
            case 'CUSTOM_COMPONENT':
                return <PuzzleIcon {...iconProps} />
            default:
                return <InfoIcon {...iconProps} />
        }
    }

    const getStepTypeColor = (type: OnboardingStepType) => {
        return getNodeTypeColor(type)
    }

    return (
        <div
            className={`
        step-node px-4 py-3 shadow-lg rounded-lg border-2 bg-white min-w-[200px] max-w-[300px]
        ${getStepTypeColor(stepType)}
        ${selected ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
        ${errors.length > 0 ? 'border-red-500 bg-red-50' : ''}
      `}
        >
            {/* Input Handle */}
            <Handle type="target" position={Position.Top} className="w-3 h-3 border-2 bg-white" />

            {/* Header */}
            <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-2">
                    {getStepIcon(stepType)}
                    <span className="font-medium text-sm text-gray-700">{stepType.replace('_', ' ')}</span>
                </div>

                <div className="flex gap-1">
                    {isSkippable && (
                        <span className="px-1 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">Skip</span>
                    )}
                    {hasCondition && (
                        <span className="px-1 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Cond</span>
                    )}
                    {isCompleted && <span className="px-1 py-0.5 bg-green-100 text-green-700 text-xs rounded">✓</span>}
                </div>
            </div>

            {/* Content */}
            <div className="space-y-1">
                <h3 className="font-semibold text-gray-900 text-sm leading-tight">{label}</h3>
                {description && <p className="text-gray-600 text-xs leading-tight line-clamp-2">{description}</p>}
            </div>

            {/* Errors */}
            {errors.length > 0 && (
                <div className="mt-2 p-1 bg-red-100 rounded text-xs text-red-700">
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

            {/* Output Handles */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="next"
                className="w-3 h-3 border-2 bg-white"
                style={{ left: '50%' }}
            />

            {isSkippable && (
                <Handle type="source" position={Position.Right} id="skip" className="w-3 h-3 border-2 bg-yellow-400" />
            )}

            {/* Previous handle on left */}
            <Handle type="source" position={Position.Left} id="previous" className="w-3 h-3 border-2 bg-gray-400" />
        </div>
    )
})

StepNode.displayName = 'StepNode'
