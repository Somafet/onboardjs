'use client'

import clsx from 'clsx'
import { ComponentPropsWithRef, useEffect, useRef } from 'react'

export default function Slider({
    onChange,
    className,
    showValue = false,
    ...props
}: ComponentPropsWithRef<'input'> & { showValue?: boolean }) {
    const inputRef = useRef<HTMLInputElement>(null)
    const handleOnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (onChange) {
            onChange(event)
        }

        const el = inputRef.current
        if (el) {
            const min = parseFloat(!el.min ? '0' : el.min)
            const max = parseFloat(!el.max ? '100' : el.max)
            const value = parseFloat(!el.value ? '0' : el.value)

            const percent = max === min ? 0 : ((value - min) / (max - min)) * 100
            el.style.setProperty('--slider-value', `${percent}%`)
        }
    }

    useEffect(() => {
        const el = inputRef.current
        if (el) {
            const min = parseFloat(!el.min ? '0' : el.min)
            const max = parseFloat(!el.max ? '100' : el.max)
            const value = parseFloat(!el.value ? '0' : el.value)

            const percent = max === min ? 0 : ((value - min) / (max - min)) * 100
            el.style.setProperty('--slider-value', `${percent}%`)
        }
    }, [])

    return (
        <div className="flex items-center gap-x-4 w-full">
            <input
                type="range"
                className={clsx('input', className)}
                {...props}
                ref={inputRef}
                onChange={handleOnChange}
            />

            {showValue && (
                <span className="text-sm font-semibold">{inputRef.current?.value || props.defaultValue || 0}</span>
            )}
        </div>
    )
}
