import { useOnboarding, type StepComponentProps } from '@onboardjs/react'
import clsx from 'clsx'
import { CheckCircleIcon, FileTextIcon, Users2Icon } from 'lucide-react'
import type { ElementType } from 'react'

const painPointOptions: Record<string, { icon: ElementType; colors: { icon: string; iconBg: string } }> = {
    completion: {
        icon: CheckCircleIcon,
        colors: {
            icon: 'text-green-500',
            iconBg: 'bg-green-100',
        },
    },
    personalization: {
        icon: Users2Icon,
        colors: {
            icon: 'text-blue-500',
            iconBg: 'bg-blue-100',
        },
    },
    data: {
        icon: FileTextIcon,
        colors: {
            icon: 'text-purple-500',
            iconBg: 'bg-purple-100',
        },
    },
}

export default function BusinessStep3(props: StepComponentProps) {
    const { next, updateContext } = useOnboarding()
    const { options } = props.payload as { options: Array<{ id: string; label: string }> }

    const handleSelect = (id: string) => {
        updateContext(() => ({
            flowData: {
                painPoint: id,
            },
        }))
        next()
    }

    return (
        <>
            <fieldset aria-label="Biggest pain points" className="mt-6">
                <div className="space-y-4">
                    {options.map((option: { id: string; label: string }) => {
                        const painPoint = painPointOptions[option.id]!
                        return (
                            <label
                                key={option.id}
                                aria-label={option.label}
                                aria-description="Select your biggest pain point"
                                className="group relative block rounded-lg border border-gray-300 bg-white px-6 py-4 hover:cursor-pointer hover:border-gray-400 has-checked:outline-2 has-checked:-outline-offset-2 has-checked:outline-blue-600 has-focus-visible:outline-3 has-focus-visible:-outline-offset-1 sm:flex sm:justify-between"
                            >
                                <input
                                    onChange={() => handleSelect(option.id)}
                                    defaultValue={option.id}
                                    name="pain-point"
                                    type="radio"
                                    className="sr-only absolute inset-0 appearance-none focus:outline-none"
                                />
                                <span className="flex items-center gap-4 text-sm">
                                    <div className={clsx('rounded-sm p-2', painPoint.colors.iconBg)}>
                                        <painPoint.icon className={clsx('size-4', painPoint.colors.icon)} />
                                    </div>
                                    <span className="font-medium text-gray-900">{option.label}</span>
                                </span>
                            </label>
                        )
                    })}
                </div>
            </fieldset>
        </>
    )
}
