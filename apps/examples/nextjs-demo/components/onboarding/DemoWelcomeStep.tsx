// components/onboarding-ui/steps/DemoWelcomeStep.tsx
'use client'
import React, { FC, useState } from 'react'
import { StepComponentProps, useOnboarding } from '@onboardjs/react' // Assuming user installs and imports this
import { Button } from '../ui/button'
import { Radio, RadioGroup } from '../ui/radio'
import { twMerge } from 'tailwind-merge'
import { DatabaseIcon, GraduationCapIcon, MergeIcon, NavigationIcon, SplitIcon } from 'lucide-react'
import Link from 'next/link'
import { Label } from '../ui/label'
import { Field } from '@headlessui/react'
import { AppOnboardingContext } from './common-flow-config'
import { usePathname } from 'next/navigation'

export interface DemoWelcomeStepPayload {
    mainText?: string
    subText?: string
    options?: {
        id: string
        label: string
        value: string
        description?: string
    }[]
    ctaLabel?: string // Optional call-to-action label for the button
}

const choiceIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    'simple-flow': MergeIcon,
    'conditional-flow': SplitIcon,
    persistence: DatabaseIcon,
}

const DemoWelcomeStep: FC<StepComponentProps<DemoWelcomeStepPayload, AppOnboardingContext>> = ({
    payload,
    coreContext,
}) => {
    const pathname = usePathname()
    const { next, updateContext } = useOnboarding<AppOnboardingContext>()
    const [selectedOption, setSelectedOption] = useState<string>(coreContext.flowData.selectedOption ?? 'simple-flow')

    const handleSelectOption = (value: string) => {
        setSelectedOption(value)
        updateContext({
            flowData: {
                selectedOption: value, // Store the selected option in flowData
            },
        })
    }
    const isNavigatorRoute = pathname.startsWith('/onboarding')

    return (
        <div className="text-center">
            <RadioGroup<string> className="flex flex-col gap-y-4" value={selectedOption}>
                {(args) => (
                    <>
                        {payload.options?.map((option, index) => {
                            const Icon = choiceIconMap[option.value] || GraduationCapIcon
                            return (
                                <Field
                                    as="button"
                                    value={option.value}
                                    onClick={() => {
                                        handleSelectOption(option.value)
                                    }}
                                    data-slot="field"
                                    key={option.value}
                                    className={`
                    animate-fade-up
                  `}
                                    style={{
                                        animationDelay: `${index * 150}ms`, // 150ms stagger
                                    }}
                                >
                                    <div
                                        className={twMerge(
                                            'relative transition-all mode-200',
                                            'rounded-xl overflow-hidden border border-gray-600',
                                            'transition-transform hover:scale-105 duration-300',
                                            args.value === option.value ? 'ring-2 ring-primary border-primary' : ''
                                        )}
                                    >
                                        <div className="p-4">
                                            <div className="flex max-sm:flex-col items-center">
                                                <div className="mr-6 max-sm:mb-4">
                                                    <Icon
                                                        className={twMerge(
                                                            'size-8 rotate-90',
                                                            index > 0 && index % 2 === 0 && 'rotate-0'
                                                        )}
                                                    />
                                                </div>

                                                <div className="w-full">
                                                    <div className="flex items-center justify-between sm:mb-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-lg font-semibold">
                                                                {option.label}
                                                            </span>
                                                        </div>
                                                        <Radio
                                                            value={String(option.value)}
                                                            id={`mode-${option.value}`}
                                                            color="primary"
                                                            className="max-sm:absolute max-sm:top-4 max-sm:right-4"
                                                        />
                                                    </div>

                                                    <div className="flex items-center gap-2 sm:mt-3">
                                                        <GraduationCapIcon className="max-sm:hidden size-4 mb-1.5" />
                                                        <Label
                                                            htmlFor={`mode-${option.value}`}
                                                            className={twMerge('text-base font-semibold')}
                                                        >
                                                            {option.description}
                                                        </Label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Field>
                            )
                        })}
                    </>
                )}
            </RadioGroup>

            <Button className="animate-jump-in animate-delay-1000 px-6 py-3 text-lg mt-8" onClick={() => next()}>
                {payload.ctaLabel ?? "Let's Go!"}
            </Button>

            <div className="animate-fade-up animate-delay-1000 mt-4">
                <Link
                    href={isNavigatorRoute ? '/' : '/onboarding/welcome'}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <NavigationIcon className="size-3.5" />
                    Or try {isNavigatorRoute ? 'without' : 'with'} URL navigation
                </Link>
            </div>
        </div>
    )
}

export default DemoWelcomeStep
