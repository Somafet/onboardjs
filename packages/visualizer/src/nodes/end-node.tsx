import { memo } from 'react'
import { Handle, Position, NodeProps, Node } from '@xyflow/react'
import { CheckCircleIcon } from 'lucide-react'

export type EndNode = Node<
    {
        label: string
        description?: string
    },
    'endNode'
>

export const EndNode = memo(({ data, selected }: NodeProps<EndNode>) => {
    const { label, description } = data

    return (
        <div
            className={`
        end-node px-4 py-3 shadow-lg rounded-lg border-2 min-w-[200px] max-w-[300px]
        border-amber-500 bg-amber-50
        ${selected ? 'ring-2 ring-amber-500 ring-opacity-50' : ''}
      `}
        >
            {/* Input Handle */}
            <Handle type="target" position={Position.Top} className="w-3 h-3 border-2 bg-white" />

            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-amber-600" />
                    <span className="font-medium text-sm text-amber-700">END</span>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-1">
                <h3 className="font-semibold text-amber-900 text-sm leading-tight">{label}</h3>
                {description && <p className="text-amber-700 text-xs leading-tight line-clamp-2">{description}</p>}
            </div>
        </div>
    )
})

EndNode.displayName = 'EndNode'
