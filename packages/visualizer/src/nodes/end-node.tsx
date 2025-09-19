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
        ${selected ? 'ring-2 ring-amber-800 ring-opacity-50' : ''}
      `}
        >
            {/* Input Handle */}
            <Handle type="target" position={Position.Top} />

            <div className="text-center">
                <p className="font-semibold text-sm text-amber-700"> End of Flow</p>
            </div>
        </div>
    )
})

EndNode.displayName = 'EndNode'
