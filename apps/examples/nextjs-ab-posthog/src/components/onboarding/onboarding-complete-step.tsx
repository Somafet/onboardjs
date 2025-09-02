'use client'

import { Button } from '@/components/ui/button'
import { useOnboarding } from '@onboardjs/react'
import { CheckCircle, ArrowRight, Sparkles } from 'lucide-react'

export function OnboardingCompleteStep() {
    const { reset } = useOnboarding()
    return (
        <>
            {/* Success Animation */}
            <div className="relative">
                <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4 animate-pulse">
                    <CheckCircle className="w-12 h-12 text-primary" />
                </div>
                <Sparkles className="w-5 h-5 text-primary/60 absolute top-2 right-1/4 animate-pulse" />
                <Sparkles className="w-4 h-4 text-primary/40 absolute bottom-2 left-1/4 animate-pulse delay-300" />
                <Sparkles className="w-3 h-3 text-primary/50 absolute top-1/2 right-2 animate-pulse delay-500" />
            </div>

            {/* Completion Message */}
            <div className="space-y-4">
                <h1 className="text-3xl font-bold tracking-tight">🎉 Welcome to KoolSaaS!</h1>
                <p className="text-muted-foreground text-lg leading-relaxed">
                    You&#39;re all set up and ready to create amazing product visualizations. Your journey to better
                    conversions starts now!
                </p>
            </div>

            {/* Achievement Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                    What you&#39;ve accomplished:
                </h3>
                <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span>Profile set up and personalized</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span>First project created</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span>Ready to connect your integrations</span>
                    </div>
                </div>
            </div>

            {/* Call to Action */}
            <div className="space-y-3">
                <Button size="lg" className="w-full" onClick={() => reset()}>
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                <p className="text-xs text-muted-foreground">Ready to create more magic? Let&#39;s dive in!</p>
            </div>
        </>
    )
}
