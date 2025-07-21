// components/FlowVisualizer/utils/flowConverters.ts
import { Node, Edge, Position } from "@xyflow/react";
import { OnboardingStep, OnboardingContext } from "@onboardjs/core";
import dagre from "dagre";
import { StepNode } from "../nodes/step-node.js";
import { ConditionalFlowEdge } from "../edges/conditional-edge.js";

export interface FlowData {
  nodes: StepNode[];
  edges: ConditionalFlowEdge[];
}

// Convert OnboardingSteps to React Flow format
export function convertStepsToFlow<
  TContext extends OnboardingContext = OnboardingContext,
>(steps: OnboardingStep<TContext>[]): FlowData {
  const nodes: StepNode[] = [];
  const edges: ConditionalFlowEdge[] = [];

  // Create nodes
  steps.forEach((step, index) => {
    const nodeData: StepNode["data"] = {
      stepId: step.id,
      stepType: step.type || "INFORMATION",
      label: getStepLabel(step),
      description: getStepDescription(step),
      isSkippable: step.isSkippable,
      hasCondition: typeof step.condition === "function",
    };

    const node: StepNode = {
      id: String(step.id),
      type: "stepNode",
      data: nodeData,
      position: { x: 0, y: index * 150 }, // Will be positioned properly by layout
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    };

    nodes.push(node);
  });

  // Create edges
  steps.forEach((step) => {
    const sourceId = String(step.id);

    // Next step edge
    const nextStepId =
      typeof step.nextStep === "function" ? "[Function]" : step.nextStep;

    if (nextStepId && nextStepId !== "[Function]") {
      edges.push({
        id: `${sourceId}-next-${nextStepId}`,
        source: sourceId,
        target: String(nextStepId),
        sourceHandle: "next",
        type: "conditional",
        data: {
          edgeType: "next",
          label: "Next",
        },
      });
    }

    // Skip step edge
    if (step.isSkippable) {
      const skipToStep = (step as any).skipToStep;
      const skipStepId =
        typeof skipToStep === "function" ? "[Function]" : skipToStep;

      if (skipStepId && skipStepId !== "[Function]") {
        edges.push({
          id: `${sourceId}-skip-${skipStepId}`,
          source: sourceId,
          target: String(skipStepId),
          sourceHandle: "skip",
          type: "conditional",
          data: {
            edgeType: "skip",
            label: "Skip",
          },
        });
      }
    }

    // Previous step edge (optional, for visualization)
    const prevStepId =
      typeof step.previousStep === "function"
        ? "[Function]"
        : step.previousStep;

    if (prevStepId && prevStepId !== "[Function]") {
      edges.push({
        id: `${sourceId}-prev-${prevStepId}`,
        source: String(prevStepId),
        target: sourceId,
        sourceHandle: "previous",
        type: "conditional",
        data: {
          edgeType: "previous",
          label: "Back",
        },
        style: { stroke: "#6b7280", strokeDasharray: "3,3" },
      });
    }
  });

  // Layout nodes
  const layouted = layoutNodes(nodes, edges);

  return {
    nodes: layouted.nodes,
    edges: layouted.edges,
  };
}

// Convert React Flow format back to OnboardingSteps
export function convertFlowToSteps<
  TContext extends OnboardingContext = OnboardingContext,
>(nodes: StepNode[], edges: ConditionalFlowEdge[]): OnboardingStep<TContext>[] {
  const steps: OnboardingStep<TContext>[] = [];

  nodes.forEach((node) => {
    const { stepId, stepType } = node.data;

    // Find connected edges
    const nextEdges = edges.filter(
      (e) => e.source === node.id && e.data?.edgeType === "next",
    );
    const skipEdges = edges.filter(
      (e) => e.source === node.id && e.data?.edgeType === "skip",
    );
    const prevEdges = edges.filter(
      (e) => e.target === node.id && e.data?.edgeType === "previous",
    );

    // Create step
    const step: Partial<OnboardingStep<TContext>> = {
      id: stepId,
      type: stepType,
    };

    // Set navigation properties based on edges
    if (nextEdges.length > 0) {
      const targetNodeId = nextEdges[0].target;
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      if (targetNode) {
        step.nextStep = targetNode.data.stepId as any;
      }
    }

    if (skipEdges.length > 0) {
      const targetNodeId = skipEdges[0].target;
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      if (targetNode) {
        (step as any).isSkippable = true;
        (step as any).skipToStep = targetNode.data.stepId;
      }
    }

    if (prevEdges.length > 0) {
      const sourceNodeId = prevEdges[0].source;
      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      if (sourceNode) {
        step.previousStep = sourceNode.data.stepId as any;
      }
    }

    // Set default payload based on type
    if (stepType && !step.payload) {
      step.payload = getDefaultPayload(stepType) as any;
    }

    steps.push(step as OnboardingStep<TContext>);
  });

  return steps;
}

// Layout nodes using dagre
export function layoutNodes<TNode extends Node, TEdge extends Edge>(
  nodes: TNode[],
  edges: TEdge[],
  direction: "TB" | "LR" = "TB",
): { nodes: TNode[]; edges: TEdge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 250, height: 120 });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // Apply dagre layout to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 125, // Adjust for node width
        y: nodeWithPosition.y - 60, // Adjust for node height
      },
    };
  });

  return {
    nodes: layoutedNodes,
    edges,
  };
}

// Helper functions
function getStepLabel<TContext extends OnboardingContext>(
  step: OnboardingStep<TContext>,
): string {
  // Try to get label from various payload properties
  const payload = step.payload as any;

  if (payload?.title) return payload.title;
  if (payload?.label) return payload.label;
  if (payload?.question) return payload.question;
  if (payload?.componentKey) return payload.componentKey;

  return `Step ${step.id}`;
}

function getStepDescription<TContext extends OnboardingContext>(
  step: OnboardingStep<TContext>,
): string | undefined {
  const payload = step.payload as any;

  if (payload?.description) return payload.description;
  if (payload?.subtitle) return payload.subtitle;
  if (payload?.options && Array.isArray(payload.options)) {
    return `${payload.options.length} options`;
  }
  if (payload?.items && Array.isArray(payload.items)) {
    return `${payload.items.length} items`;
  }

  return undefined;
}

function getDefaultPayload(stepType: string): Record<string, any> {
  switch (stepType) {
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE":
      return { options: [] };
    case "CHECKLIST":
      return { dataKey: "checklist_data", items: [] };
    case "CUSTOM_COMPONENT":
      return { componentKey: "DefaultComponent" };
    default:
      return {};
  }
}
