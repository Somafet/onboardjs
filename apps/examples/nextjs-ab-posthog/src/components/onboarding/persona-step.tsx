'use client'

import {
    ArrowRightIcon,
    BarChart3Icon,
    CodeIcon,
    MegaphoneIcon,
    ShoppingCartIcon,
    UserIcon,
    WandSparklesIcon,
} from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { useOnboarding } from '@onboardjs/react'
import { useState } from 'react'
import type { PersonaOption, UserRole } from '@/types/types'

const personaOptions: PersonaOption[] = [
    {
        id: 'product-manager',
        title: 'Product Manager',
        description: 'Enhance product showcases & stakeholder presentations',
        icon: 'BarChart3',
    },
    {
        id: 'marketing-professional',
        title: 'Marketing Professional',
        description: 'Create engaging ad creatives & campaigns',
        icon: 'Megaphone',
    },
    {
        id: 'software-engineer',
        title: 'Software Engineer / Developer',
        description: 'Integrate stunning 3D into your apps',
        icon: 'Code',
    },
    {
        id: 'other',
        title: 'Other',
        description: 'Tell us about your specific use case',
        icon: 'User',
    },
]

const iconMap = {
    ShoppingCart: ShoppingCartIcon,
    BarChart3: BarChart3Icon,
    Megaphone: MegaphoneIcon,
    Code: CodeIcon,
    User: UserIcon,
}

export default function PersonaStep() {
    const { next, previous, updateContext, state } = useOnboarding()
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
    const [customRole, setCustomRole] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleNext = async () => {
        if (!selectedRole) return

        setIsLoading(true)

        try {
            updateContext({ flowData: { userRole: selectedRole, customRole } })
            next()
        } catch (error) {
            console.error('Failed to create user profile:', error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <WandSparklesIcon className="w-10 h-10 text-primary animate-in fade-in zoom-in duration-300" />
            </div>
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-3">Tell us about yourself</h1>
                <p className="text-muted-foreground text-lg">
                    Help us tailor your KoolSaaS experience to your specific needs
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-8">
                {personaOptions.map((option, idx) => {
                    const IconComponent = iconMap[option.icon as keyof typeof iconMap]
                    const isSelected = selectedRole === option.id

                    return (
                        <Card
                            key={option.id}
                            className={`fade-in animate-in fill-mode-forwards cursor-pointer duration-200 hover:shadow-lg hover:scale-[1.02] transition-all ${
                                isSelected
                                    ? 'ring-2 ring-primary bg-primary/5 border-primary/50'
                                    : 'hover:border-primary/30'
                            }`}
                            style={{
                                animationDelay: `${idx * 100}ms`,
                            }}
                            onClick={() => setSelectedRole(option.id)}
                        >
                            <CardContent className="text-left">
                                <div className="sm:flex items-start max-sm:space-y-4 sm:space-x-4">
                                    <div
                                        className={`p-3 rounded-lg max-sm:w-fit ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                                    >
                                        <IconComponent className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold mb-2">{option.title}</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {option.description}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {selectedRole === 'other' && (
                <Card className="mb-8 border-primary/20">
                    <CardContent className="p-6">
                        <div className="space-y-3">
                            <Label htmlFor="customRole" className="text-base font-medium">
                                Tell us about your role
                            </Label>
                            <Input
                                id="customRole"
                                placeholder="e.g., UX Designer, Startup Founder, Content Creator..."
                                value={customRole}
                                onChange={(e) => setCustomRole(e.target.value)}
                                className="text-base"
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex justify-center gap-x-4">
                <Button onClick={() => previous()} size="lg" variant={'outline'} className="sm:min-w-[200px]">
                    Back
                </Button>
                <Button
                    onClick={() => handleNext()}
                    disabled={!state?.canGoNext || isLoading || !selectedRole}
                    size="lg"
                    className="sm:min-w-[200px]"
                >
                    {isLoading ? (
                        'Setting up your profile...'
                    ) : (
                        <>
                            Next
                            <ArrowRightIcon className="size-4 ml-2" />
                        </>
                    )}
                </Button>
            </div>
        </>
    )
}
