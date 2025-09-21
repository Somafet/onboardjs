'use client'

import { OnboardingStepType } from '@onboardjs/core'
import { InfoIcon, GitBranchIcon } from 'lucide-react'
import { ReactNode, DragEvent } from 'react'

interface NodeTypeItem {
    type: 'step' | 'condition'
    stepType?: OnboardingStepType
    id: string
    label: string
    description: string
    icon: ReactNode
    color: string
}

const nodeTypes: NodeTypeItem[] = [
    {
        type: 'step',
        stepType: 'INFORMATION',
        id: 'information',
        label: 'Step',
        description: 'Basic Step',
        icon: <InfoIcon className="vis:size-5" />,
        color: 'vis:text-blue-600 vis:bg-blue-50 vis:border-blue-200',
    },
    {
        type: 'condition',
        id: 'condition',
        label: 'Condition',
        description: 'Add conditional branching',
        icon: <GitBranchIcon className="vis:size-5" />,
        color: 'vis:text-indigo-600 vis:bg-indigo-50 vis:border-indigo-200',
    },
]

export function NodePalette() {
    const onDragStart = (event: DragEvent, nodeType: NodeTypeItem) => {
        event.dataTransfer.setData(
            'application/reactflow',
            JSON.stringify({
                type: nodeType.type,
                stepType: nodeType.stepType,
                label: nodeType.label,
            })
        )
        event.dataTransfer.effectAllowed = 'move'
    }

    return (
        <div className="node-palette vis:bg-white vis:border-r vis:border-gray-200 vis:w-96 vis:h-full vis:flex vis:flex-col vis:shadow-sm">
            {/* Header */}
            <div className="vis:flex vis:items-center vis:justify-between vis:p-4 vis:border-b vis:border-gray-200">
                <div>
                    <h2 className="vis:font-semibold vis:text-gray-900">Node Palette</h2>
                    <p className="vis:text-xs vis:text-gray-500 vis:mt-1">Drag nodes to add them to your flow</p>
                </div>
            </div>

            {/* Node Types */}
            <div className="vis:flex-1 vis:overflow-y-auto vis:px-3 vis:py-4">
                <div className="vis:space-y-6">
                    {nodeTypes.map((nodeType) => (
                        <div
                            key={nodeType.id}
                            draggable
                            onDragStart={(event) => onDragStart(event, nodeType)}
                            className={`
                                vis:p-3 vis:rounded-lg vis:border-2 vis:border-dashed vis:cursor-move vis:transition-all
                                vis:hover:shadow-md vis:hover:scale-105 vis:select-none
                                ${nodeType.color}
                            `}
                            title={`Drag to add ${nodeType.label}`}
                        >
                            <div className="vis:flex vis:items-start vis:gap-3">
                                <div className="vis:flex-shrink-0 vis:mt-0.5">{nodeType.icon}</div>
                                <div className="vis:flex-1 vis:min-w-0">
                                    <div className="vis:font-medium vis:text-sm">{nodeType.label}</div>
                                    <div className="vis:text-xs vis:opacity-75 vis:mt-1 vis:leading-tight">
                                        {nodeType.description}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Instructions */}
            <div className="vis:p-4 vis:border-t vis:border-gray-200 vis:bg-gray-50">
                <div className="vis:text-xs vis:text-gray-600 vis:space-y-1">
                    <div className="vis:flex vis:items-center vis:gap-2">
                        <div className="vis:w-2 vis:h-2 vis:bg-indigo-500 vis:rounded-full"></div>
                        <span>Drag nodes onto the canvas</span>
                    </div>
                    <div className="vis:flex vis:items-center vis:gap-2">
                        <div className="vis:w-2 vis:h-2 vis:bg-green-500 vis:rounded-full"></div>
                        <span>Connect nodes to create flows</span>
                    </div>
                    <div className="vis:flex vis:items-center vis:gap-2">
                        <div className="vis:w-2 vis:h-2 vis:bg-blue-500 vis:rounded-full"></div>
                        <span>Click nodes to edit properties</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
