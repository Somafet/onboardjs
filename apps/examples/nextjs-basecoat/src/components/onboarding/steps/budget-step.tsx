'use client'

import Link from 'next/link'
import StepLayout from '../StepLayout'
import 'basecoat-css'
import { YoutubeIcon } from 'lucide-react'
import Slider from '@/components/slider'
import { BudgetChart } from '@/components/charts/budget-chart'
import { StepComponentProps, useOnboarding } from '@onboardjs/react'

const Aside = () => (
    <div>
        <h3 className="text-lg font-semibold">Balance your week with Custom Work Budget</h3>
        <p className="text-muted mt-6">
            Define your work week by establishing a customized work budget. Decide on your work hours for weekdays and
            weekends, fostering a routine that maintains focus and promotes overall well-being.
        </p>

        <Link
            href="https://youtube.com"
            target="_blank"
            className="px-5 py-5.5 mt-10 bg-zinc-900 rounded-lg flex items-center gap-x-4"
        >
            <YoutubeIcon className="size-8" />{' '}
            <span className="tracking-wide font-semibold">Watch a video to learn more</span>
        </Link>
    </div>
)

export default function BudgetStep({ coreContext }: StepComponentProps) {
    const { updateContext } = useOnboarding()

    const handleWorkdayChange = (value: string) => {
        updateContext({
            flowData: {
                workdayHours: Number(value),
            },
        })
    }

    const handleWeekendChange = (value: string) => {
        updateContext({
            flowData: {
                weekendHours: Number(value),
            },
        })
    }

    const workdayHours = coreContext.flowData.workdayHours === undefined ? 5 : coreContext.flowData.workdayHours
    const weekendHours = coreContext.flowData.weekendHours === undefined ? 5 : coreContext.flowData.weekendHours

    return (
        <StepLayout aside={<Aside />}>
            <h2 className="text-2xl font-bold mb-12">Define Work Budget</h2>
            <div className="flex gap-x-8 mb-8">
                <span>Workday</span>
                <Slider
                    className="green-slider"
                    min="0"
                    max="10"
                    step="1"
                    defaultValue={workdayHours}
                    showValue
                    onChange={(e) => handleWorkdayChange(e.target.value)}
                />
            </div>

            <div className="flex gap-x-8">
                <span>Weekend</span>
                <Slider
                    className="pink-slider"
                    min="0"
                    max="10"
                    step="1"
                    defaultValue={weekendHours}
                    showValue
                    onChange={(e) => handleWeekendChange(e.target.value)}
                />
            </div>

            <div className="mt-12">
                <BudgetChart weekendHours={weekendHours} workdayHours={workdayHours} />
            </div>

            <div className="w-full mt-6 flex items-center justify-end max-w-[700px]">
                <div className="">
                    <p className="font-semibold">{workdayHours * 5 + weekendHours * 2} hours / week</p>
                </div>
            </div>
        </StepLayout>
    )
}
