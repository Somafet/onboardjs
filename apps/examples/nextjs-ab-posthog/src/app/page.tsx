import ExperimentOverride from '@/components/experiment-override'
import OnboardingProgress from '@/components/onboarding/onboarding-progress'
import OnboardingUI from '@/components/onboarding/onboarding-ui'
import OnboardingWrapper from '@/components/onboarding/onboarding-wrapper'
import OnobardJSLogo from '@/components/OnboardJSLogo'
import { AppWindowMacIcon, FileCodeIcon, GlobeIcon } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
    return (
        <OnboardingWrapper>
            <div className="relative bg-gradient-to-br from-background to-primary/10 grid sm:grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen px-2 pt-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
                {/* Diagonal Fade Grid Background - Top Left */}
                <div
                    className="absolute inset-0 -z-10 rotate-180 pointer-events-none"
                    style={{
                        backgroundImage: `
        linear-gradient(to right, #d1d5db 1px, transparent 1px),
        linear-gradient(to bottom, #d1d5db 1px, transparent 1px)
      `,
                        backgroundSize: '32px 32px',
                        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 0% 0%, #000 50%, transparent 90%)',
                        maskImage: 'radial-gradient(ellipse 80% 80% at 0% 0%, #000 50%, transparent 90%)',
                    }}
                />
                <main className="flex flex-col gap-[32px] sm:row-start-2 items-center sm:items-start ">
                    <Link href="https://onboardjs.com" className="flex items-end gap-2 justify-center flex-nowrap">
                        <OnobardJSLogo className="block size-8" />
                        <span className="block text-md font-semibold">OnboardJS</span>
                    </Link>

                    <OnboardingProgress />
                    <OnboardingUI />
                    <ExperimentOverride />
                </main>
                <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
                    <a
                        className="flex items-center gap-2 hover:underline hover:underline-offset-4"
                        href="https://docs.onboardjs.com"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FileCodeIcon className="size-4" />
                        Learn
                    </a>
                    <a
                        className="flex items-center gap-2 hover:underline hover:underline-offset-4"
                        href="https://github.com/Somafet/onboardjs/tree/dd2e2d379d39e368d9a9cd2a93a10878e769d053/apps/examples"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <AppWindowMacIcon className="size-4" />
                        Examples
                    </a>
                    <a
                        className="flex items-center gap-2 hover:underline hover:underline-offset-4"
                        href="https://onboardjs.com"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <GlobeIcon className="size-4" />
                        Go to onboardjs.com →
                    </a>
                </footer>
            </div>
        </OnboardingWrapper>
    )
}
