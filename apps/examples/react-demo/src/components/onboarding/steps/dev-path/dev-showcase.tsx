import { useOnboarding } from '@onboardjs/react'

export default function DevOnboardJSShowcase() {
    const { next, previous } = useOnboarding()
    return (
        <>
            <h2 className="mt-4 text-lg leading-6 font-medium text-gray-900">
                This demo <span className="font-bold">ITSELF</span> is built with OnboardJS
            </h2>
            <p className="mt-1 text-sm text-gray-500 max-w-md">
                Let’s see how OnboardJS helps you build beautiful, custom onboarding experiences tailored to your users.
            </p>

            <video
                src="/onboardjs-quick-showcase.mp4"
                className="mt-4 rounded-lg shadow-md aspect-square w-full mx-auto max-w-lg"
                playsInline
                muted
                autoPlay
                loop
                controls={false}
            />

            <div className="mt-6 flex w-full justify-end">
                <button
                    onClick={() => previous()}
                    className="mr-2 rounded-md bg-gray-200 px-4 py-2 text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    Back
                </button>
                <button
                    onClick={() => next()}
                    className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    Continue
                </button>
            </div>
        </>
    )
}
