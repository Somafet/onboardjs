'use client'

import { OnboardingStepType } from '@onboardjs/core'
import {
    InfoIcon,
    CheckCircleIcon,
    ListIcon,
    HandIcon,
    ListChecksIcon,
    PuzzleIcon,
    GitBranchIcon,
    XIcon,
} from 'lucide-react'

interface NodeTypeItem {
    type: 'step' | 'condition'
    stepType?: OnboardingStepType
    id: string
    label: string
    description: string
    icon: React.ReactNode
    color: string
}

const nodeTypes: NodeTypeItem[] = [
    {
        type: 'step',
        stepType: 'INFORMATION',
        id: 'information',
        label: 'Step',
        description: 'Basic Step',
        icon: <InfoIcon className="w-5 h-5" />,
        color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
        type: 'condition',
        id: 'condition',
        label: 'Condition',
        description: 'Add conditional branching',
        icon: <GitBranchIcon className="w-5 h-5" />,
        color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
]

export function NodePalette() {
    const onDragStart = (event: React.DragEvent, nodeType: NodeTypeItem) => {
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
        <div className="node-palette bg-white border-r border-gray-200 w-96 h-full flex flex-col shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div>
                    <h2 className="font-semibold text-gray-900">Node Palette</h2>
                    <p className="text-xs text-gray-500 mt-1">Drag nodes to add them to your flow</p>
                </div>
            </div>

            {/* Node Types */}
            <div className="flex-1 overflow-y-auto px-3 py-4">
                <div className="space-y-6">
                    {nodeTypes.map((nodeType) => (
                        <div
                            key={nodeType.id}
                            draggable
                            onDragStart={(event) => onDragStart(event, nodeType)}
                            className={`
                                p-3 rounded-lg border-2 border-dashed cursor-move transition-all
                                hover:shadow-md hover:scale-105 select-none
                                ${nodeType.color}
                            `}
                            title={`Drag to add ${nodeType.label}`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-0.5">{nodeType.icon}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{nodeType.label}</div>
                                    <div className="text-xs opacity-75 mt-1 leading-tight">{nodeType.description}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Instructions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                        <span>Drag nodes onto the canvas</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Connect nodes to create flows</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>Click nodes to edit properties</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
