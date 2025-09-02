import { useOnboarding } from '@onboardjs/react'
import clsx from 'clsx'
import { Code2Icon, RocketIcon } from 'lucide-react'
const onboardingTypes = [
    {
        id: 'developer',
        ariaLabel: 'I want to build a custom onboarding flow',
        name: (
            <span>
                I want to <span className="font-bold italic">build</span> a custom onboarding flow.
            </span>
        ),
        icon: Code2Icon,
        colors: {
            icon: 'text-blue-600',
            iconBg: 'bg-blue-100',
        },
    },
    {
        id: 'business-rep',
        ariaLabel: 'I want to optimize our existing onboarding',
        name: (
            <span>
                I want to <span className="font-bold italic">optimize</span> our existing onboarding.
            </span>
        ),
        icon: RocketIcon,
        colors: {
            icon: 'text-orange-600',
            iconBg: 'bg-orange-100',
        },
    },

    // You can uncomment this section if you want to include the "looking" option

    // Pros: It allows users to explore without commitment. Increases traffic.
    // Cons: It gives users an "easy out" from making a commitment, even a small one.

    // {
    //   id: 'looking',
    //   name: 'I’m just looking around',
    //   icon: EyeIcon,
    //   colors: {
    //     icon: 'text-yellow-600',
    //     iconBg: 'bg-yellow-100',
    //   },
    // },
]

export default function InitialStep() {
    const { updateContext, next } = useOnboarding()

    const handleNext = (id: string) => {
        updateContext({ flowData: { onboardingType: id } })
        next()
    }

    return (
        <>
            <fieldset aria-label="Onboarding type" className="animate-fade-up">
                <div className="space-y-4">
                    {onboardingTypes.map((onboardingType) => (
                        <label
                            key={onboardingType.id}
                            aria-label={onboardingType.ariaLabel ?? onboardingType.name}
                            aria-description="Select your onboarding type"
                            className="group relative block rounded-lg border border-gray-300 bg-white px-6 py-4 hover:cursor-pointer hover:border-gray-400 has-checked:outline-2 has-checked:-outline-offset-2 has-checked:outline-blue-600 has-focus-visible:outline-3 has-focus-visible:-outline-offset-1 sm:flex sm:justify-between"
                        >
                            <input
                                onChange={() => handleNext(onboardingType.id)}
                                defaultValue={onboardingType.id}
                                name="onboarding-type"
                                type="radio"
                                className="sr-only absolute inset-0 appearance-none focus:outline-none"
                            />
                            <span className="flex items-center gap-4 text-sm">
                                <div className={clsx('rounded-sm p-2', onboardingType.colors.iconBg)}>
                                    <onboardingType.icon className={clsx('size-4', onboardingType.colors.icon)} />
                                </div>
                                <span className="font-medium text-gray-900">{onboardingType.name}</span>
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>
        </>
    )
}
