import { useEffect } from 'react'
import StepLayout from '../StepLayout'
import confetti from 'canvas-confetti'
import Link from 'next/link'

export default function CompleteStep() {
    useEffect(() => {
        confetti({
            particleCount: 200,
            angle: 60,
            spread: 55,
            startVelocity: 80,
            origin: { x: 0, y: 0.6 },
        })
        // Fire confetti from the right side
        confetti({
            particleCount: 200,
            angle: 120,
            spread: 55,
            startVelocity: 80,
            origin: { x: 1, y: 0.6 },
        })
    }, [])

    return (
        <StepLayout aside={<></>}>
            <div className="flex flex-col items-center justify-center h-full">
                <div className="max-w-lg flex flex-col items-center justify-center">
                    <h1 className="text-2xl font-bold mb-8 animate-fade-up">🎉 Onboarding Complete!</h1>
                    <p className="text-lg text-muted animate-fade-up animate-delay-300 text-center">
                        Your projects and work hours budget are now set! View your dashboard to see the details and
                        start managing your projects effectively.
                    </p>

                    <Link href="https://docs.onboardjs.com" className="btn mt-8 animate-fade-up animate-delay-600">
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        </StepLayout>
    )
}
