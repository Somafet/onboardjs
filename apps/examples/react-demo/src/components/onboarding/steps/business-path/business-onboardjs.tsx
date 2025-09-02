import { useOnboarding } from '@onboardjs/react'
import { lazy, Suspense } from 'react'
import ChartSkeleton from '../../../skeleton/chart-skeleton'
const UserOnboardingChart = lazy(() => import('./user-onboarding-chart'))

export default function BusinessWithOnboardJS() {
    const { next, previous } = useOnboarding()
    return (
        <>
            <Suspense fallback={<ChartSkeleton />}>
                <UserOnboardingChart className="my-4" />
            </Suspense>

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
                    Next
                </button>
            </div>
        </>
    )
}
