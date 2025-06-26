"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  hours: {
    label: "Hours",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

type BudgetChartProps = {
  weekendHours?: number;
  workdayHours?: number;
}

export function BudgetChart({ weekendHours = 5, workdayHours = 5 }: BudgetChartProps) {
  const chartData = [
    { day: "Mon", hours: workdayHours, fill: "var(--chart-1)" },
    { day: "Tue", hours: workdayHours, fill: "var(--chart-1)" },
    { day: "Wed", hours: workdayHours, fill: "var(--chart-1)" },
    { day: "Thu", hours: workdayHours, fill: "var(--chart-1)" },
    { day: "Fri", hours: workdayHours, fill: "var(--chart-1)" },
    { day: "Sat", hours: weekendHours, fill: "var(--chart-2)" },
    { day: "Sun", hours: weekendHours, fill: "var(--chart-2)" },
  ];

  return (
    <ChartContainer config={chartConfig} className="max-w-[700px]">
      <BarChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => value.slice(0, 3)}
        />

        <YAxis
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => `${value}h`}
          width={50}
        />

        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Bar dataKey="hours" fill="var(--color-hours)" radius={8} />
      </BarChart>
    </ChartContainer>
  );
}
