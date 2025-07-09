import { useState } from "react";
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  type LegendPayload,
} from "recharts";
import type { DataKey } from "recharts/types/util/types";

const onboardingImpactData = [
  {
    name: "Baseline", // Pre-OnboardJS/initial state
    churn: 28, // % churn
    conversion: 7, // % conversion
  },
  {
    name: "Month 1", // Initial implementation, immediate improvement
    churn: 20,
    conversion: 11,
  },
  {
    name: "Month 2", // Minor dip or plateau as you learn/iterate
    churn: 22, // Slight increase in churn, or plateau
    conversion: 10, // Slight dip in conversion
  },
  {
    name: "Month 3", // Major optimization/breakthrough
    churn: 14,
    conversion: 15,
  },
  {
    name: "Month 4", // Sustained improvement, perhaps a new feature
    churn: 10,
    conversion: 19,
  },
  {
    name: "Month 5", // Small refinement, incremental gain
    churn: 9,
    conversion: 21,
  },
  {
    name: "Month 6", // Significant improvement or hitting a new peak
    churn: 6,
    conversion: 25,
  },
];

type UserOnboardingChartProps = {
  className?: string;
};

export default function UserOnboardingChart({
  className,
}: UserOnboardingChartProps) {
  const [hoveringDataKey, setHoveringDataKey] =
    useState<DataKey<unknown> | null>(null);

  let conversionOpacity = 1;
  let churnOpacity = 1;

  if (hoveringDataKey === "conversion") {
    churnOpacity = 0.5;
  }

  if (hoveringDataKey === "churn") {
    conversionOpacity = 0.5;
  }

  const handleMouseEnter = (payload: LegendPayload) => {
    setHoveringDataKey(payload.dataKey ?? null);
  };

  const handleMouseLeave = () => {
    setHoveringDataKey(null);
  };
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minWidth={300}
      minHeight={200}
      className={className}
    >
      <LineChart width={300} height={100} data={onboardingImpactData}>
        <Line
          type="monotone"
          dataKey="churn"
          stroke="#ff7300"
          strokeWidth={2}
          strokeOpacity={churnOpacity}
          strokeDasharray="5 5"
        />
        <Line
          type="monotone"
          dataKey="conversion"
          stroke="#387908"
          strokeWidth={2}
          strokeOpacity={conversionOpacity}
        />
        <Legend
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
