import { Edge, EdgeProps, getSmoothStepPath } from "@xyflow/react";

export type ConditionalFlowEdge = Edge<
  {
    label?: string;
    condition?: string;
    edgeType: "next" | "previous" | "skip" | "conditional";
  },
  "conditional"
>;

export function ConditionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  markerEnd,
}: EdgeProps<ConditionalFlowEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeType = data?.edgeType || "next";

  const getEdgeStyle = () => {
    switch (edgeType) {
      case "skip":
        return { stroke: "#f59e0b", strokeWidth: 2, strokeDasharray: "5,5" };
      case "previous":
        return { stroke: "#6b7280", strokeWidth: 2, strokeDasharray: "3,3" };
      case "conditional":
        return { stroke: "#3b82f6", strokeWidth: 2, strokeDasharray: "8,4" };
      default:
        return { stroke: "#374151", strokeWidth: 2 };
    }
  };

  return (
    <>
      <path
        id={id}
        style={getEdgeStyle()}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {label && (
        <text
          x={labelX}
          y={labelY}
          className="react-flow__edge-text"
          style={{ fontSize: "12px", fill: "#374151" }}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          <tspan
            x={labelX}
            dy="0"
            style={{
              fill: "#fff",
              stroke: "#374151",
              strokeWidth: "3px",
              paintOrder: "stroke fill",
            }}
          >
            {label}
          </tspan>
        </text>
      )}
    </>
  );
}
