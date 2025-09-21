import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { EndNodeType } from '../types/node-types'

export const EndNode = memo(({ selected }: NodeProps<EndNodeType>) => {
    return (
        <div
            className={`
        end-node vis:px-4 vis:py-3 vis:shadow-lg vis:rounded-lg vis:border-2 vis:min-w-[200px] vis:max-w-[300px]
        vis:border-amber-500 vis:bg-amber-50
        ${selected ? 'vis:ring-2 vis:ring-amber-800 vis:ring-opacity-50' : ''}
      `}
        >
            {/* Input Handle */}
            <Handle type="target" position={Position.Top} />

            <div className="vis:text-center">
                <p className="vis:font-semibold vis:text-sm vis:text-amber-700"> End of Flow</p>
            </div>
        </div>
    )
})

EndNode.displayName = 'EndNode'
