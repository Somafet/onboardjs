import { useOnboarding } from '@onboardjs/react'

export default function EndStep() {
    const { currentStep, next } = useOnboarding()

    const onSubmit = (data: unknown) => {
        console.log('Form submitted:', data)
        // Perform any additional actions here

        // Finishing the onboarding flow
        next()
    }

    return (
        <form className="animate-fade text-zinc-950" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label htmlFor="firstName" className="block text-sm/6 font-semibold">
                        First Name
                    </label>
                    <div className="mt-2">
                        <input
                            id="firstName"
                            placeholder="John"
                            className="block w-full rounded-md bg-white px-3 py-1.5 text-base outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="lastName" className="block text-sm/6 font-semibold">
                        Last Name
                    </label>
                    <div className="mt-2">
                        <input
                            id="lastName"
                            placeholder="Doe"
                            className="block w-full rounded-md bg-white px-3 py-1.5 text-base outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
                        />
                    </div>
                </div>
            </div>
            <div className="mt-4">
                <label htmlFor="email" className="block text-sm/6 font-semibold">
                    Email
                </label>
                <div className="mt-2">
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck="false"
                        placeholder="jane@company.com"
                        className="block w-full rounded-md bg-white px-3 py-1.5 text-base outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
                    />
                </div>
            </div>

            <p className="my-6 mr-4 max-w-sm text-xs text-zinc-500">
                This is just a demo form to showcase the end step of the onboarding flow.
            </p>
            <div className="flex w-full justify-end">
                <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {currentStep?.meta?.cta ?? 'Submit'}
                </button>
            </div>
        </form>
    )
}
