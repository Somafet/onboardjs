import { Legend, Line, LineChart, ResponsiveContainer } from 'recharts'

const badOnboardingImpactData = [
    {
        name: 'Baseline', // Pre-OnboardJS/initial state
        churn: 5, // % churn
    },
    {
        name: 'Month 1',
        churn: 22,
    },
    {
        name: 'Month 2',
        churn: 13,
    },
    {
        name: 'Month 3',
        churn: 17,
    },
    {
        name: 'Month 4',
        churn: 22,
    },
    {
        name: 'Month 5',
        churn: 30,
    },
    {
        name: 'Month 6',
        churn: 43,
    },
]

type ChurnIncreaseChartProps = {
    className?: string
}

export default function ChurnIncreaseChart({ className }: ChurnIncreaseChartProps) {
    return (
        <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={200} className={className}>
            <LineChart width={300} height={100} data={badOnboardingImpactData}>
                <Line type="monotone" dataKey="churn" stroke="#ff7300" strokeWidth={2} strokeDasharray="5 5" />
                <Legend />
            </LineChart>
        </ResponsiveContainer>
    )
}
