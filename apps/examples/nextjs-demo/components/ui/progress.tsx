'use client'

import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'

import { cn } from '@/lib/utils'

function Progress({ className, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
    return (
        <ProgressPrimitive.Root
            data-slot="progress"
            className={cn('bg-primary/30 relative h-2 w-full overflow-hidden rounded-full', className)}
            {...props}
        >
            <ProgressPrimitive.Indicator
                data-slot="progress-indicator"
                className="bg-primary h-full transition-all duration-500 ease-in-out"
                style={{ width: `${value || 0}%` }}
            />
        </ProgressPrimitive.Root>
    )
}

export { Progress }
