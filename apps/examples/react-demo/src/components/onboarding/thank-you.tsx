import { useOnboarding } from '@onboardjs/react'
import { Avatar } from '../avatar'

export default function ThankYou() {
    const { state } = useOnboarding()

    const isBuilder = state?.context?.flowData?.onboardingType === 'developer'
    return (
        <div className="flex flex-col sm:min-w-sm divide-y divide-gray-200 overflow-hidden rounded-lg bg-white text-zinc-950 shadow-sm xl:max-w-none min-h-[600px]">
            <div className="px-4 py-6 sm:p-6">
                <div className="flex items-center gap-2">
                    <Avatar className="size-12" src="/soma.jpg" />
                    <div>
                        <p className="text-base font-bold">Soma Somorjai</p>
                        <p className="">Onboarding Developer</p>
                    </div>
                </div>
            </div>
            <div className="animate-fade px-4 py-6 sm:p-6 grow flex flex-col max-w-lg">
                {isBuilder ? (
                    <div className="mb-6 sm:mb-8">
                        <h2 className="text-lg leading-6 font-medium text-gray-900">
                            🎉 Thanks for Exploring! Your OnboardJS Example Awaits.
                        </h2>

                        <p className="mt-1 max-sm:max-w-md text-sm text-gray-500">
                            We’re thrilled you’re ready to build!
                        </p>

                        <p className="mt-4 text-sm text-gray-950">What’s next?</p>

                        <ul className="mt-2 max-sm:max-w-md list-disc space-y-2 pl-5 text-sm text-gray-900">
                            <li>
                                <span className="font-semibold">Start building:</span> with OnboardJS and see how it can
                                transform your onboarding experience.
                                <br />
                                <a href="/docs" target="_blank" className="text-blue-600 hover:text-blue-800">
                                    Read the docs
                                </a>
                            </li>
                            <li>
                                <span className="font-semibold">Join our community:</span> to share your progress and
                                get support.{' '}
                                <a
                                    href="https://discord.onboardjs.com"
                                    target="_blank"
                                    className="text-blue-600 hover:text-blue-800"
                                >
                                    Join our Discord
                                </a>
                            </li>
                        </ul>

                        <p className="mt-8">Happy building!</p>
                    </div>
                ) : (
                    <div className="mb-6 sm:mb-8">
                        <h2 className="text-lg leading-6 font-medium text-gray-900">
                            🎉 Thank You for Exploring! Your Optimization Toolkit is On Its Way.
                        </h2>

                        <p className="mt-1 max-sm:max-w-md text-sm text-gray-500">
                            We appreciate you taking the step to optimize your user experience!
                        </p>

                        <p className="mt-4 text-sm text-gray-950">What’s next?</p>

                        <ul className="mt-2 max-sm:max-w-md list-disc space-y-2 pl-5 text-sm text-gray-900">
                            <li>
                                <span className="font-semibold">Drive growth:</span> This example isn’t just code; it’s
                                a blueprint for improving conversion rates and user retention. The accompanying guide
                                will show you how to apply these strategies to your product.
                            </li>
                            <li>
                                <span className="font-semibold">Ready for a chat?</span> If you’re eager to discuss your
                                specific onboarding challenges and how OnboardJS can help you achieve your growth goals,
                                book a quick call with our team.
                            </li>
                        </ul>

                        <a
                            href="#"
                            target="_blank"
                            className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
                        >
                            Worth bouncing around a few ideas?
                        </a>

                        <p className="mt-8">Here’s to smarter onboarding!</p>
                    </div>
                )}
            </div>
        </div>
    )
}
