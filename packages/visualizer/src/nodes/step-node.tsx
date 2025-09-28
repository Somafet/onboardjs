import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { OnboardingStepType } from '@onboardjs/core'
import { InfoIcon, CheckCircleIcon, ListIcon, HandIcon, ListChecksIcon, PuzzleIcon } from 'lucide-react'
import { StepNodeType, getStepTypeColor as getNodeTypeColor } from '../types/node-types'

export const StepNode = memo(({ data, selected }: NodeProps<StepNodeType>) => {
    const { stepType, label, description, isSkippable, hasCondition, isCompleted, errors = [] } = data

    const getStepIcon = (type: OnboardingStepType) => {
        const iconProps = { className: 'vis:size-5' }

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
        step-node vis:px-4 vis:py-3 vis:shadow-lg vis:rounded-lg vis:border-2 vis:bg-white vis:min-w-[200px] vis:max-w-[300px]
        ${getStepTypeColor(stepType)}
        ${selected ? 'vis:ring-2 vis:ring-blue-500 vis:ring-opacity-50' : ''}
        ${errors.length > 0 ? 'vis:border-red-500 vis:bg-red-50' : ''}
      `}
        >
            {/* Input Handle */}
            <Handle type="target" position={Position.Top} className="vis:w-3 vis:h-3 vis:border-2 vis:bg-white" />

            {/* Header */}
            <div className="vis:flex vis:items-center vis:justify-between vis:mb-2 vis:gap-2">
                <div className="vis:flex vis:items-center vis:gap-2">
                    {getStepIcon(stepType)}
                    <span className="vis:font-medium vis:text-sm vis:text-gray-700">{stepType.replace('_', ' ')}</span>
                </div>

                <div className="vis:flex vis:gap-1">
                    {isSkippable && (
                        <span className="vis:px-1 vis:py-0.5 vis:bg-yellow-100 vis:text-yellow-700 vis:text-xs vis:rounded">
                            Skip
                        </span>
                    )}
                    {hasCondition && (
                        <span className="vis:px-1 vis:py-0.5 vis:bg-blue-100 vis:text-blue-700 vis:text-xs vis:rounded">
                            Cond
                        </span>
                    )}
                    {isCompleted && (
                        <span className="vis:px-1 vis:py-0.5 vis:bg-green-100 vis:text-green-700 vis:text-xs vis:rounded">
                            ✓
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="vis:space-y-1">
                <h3 className="vis:font-semibold vis:text-gray-900 vis:text-sm vis:leading-tight">{label}</h3>
                {description && (
                    <p className="vis:text-gray-600 vis:text-xs vis:leading-tight vis:line-clamp-2">{description}</p>
                )}
            </div>

            {/* Errors */}
            {errors.length > 0 && (
                <div className="vis:mt-2 vis:p-1 vis:bg-red-100 vis:rounded vis:text-xs vis:text-red-700">
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

            {/* Output Handles */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="next"
                className="vis:size-3 vis:border-2 vis:bg-white"
                style={{ left: '50%' }}
            />

            <Handle
                type="source"
                position={Position.Right}
                id="skip"
                className="vis:size-3 vis:border-2 vis:bg-yellow-400"
            />

            {/* Previous handle on left */}
            <Handle
                type="source"
                position={Position.Left}
                id="previous"
                className="vis:size-3 vis:border-2 vis:bg-gray-400"
            />
        </div>
    )
})

StepNode.displayName = 'StepNode'
