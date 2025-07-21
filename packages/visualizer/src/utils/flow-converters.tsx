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

    // Previous step edge
    const prevStepId =
      typeof step.previousStep === "function"
        ? "[Function]"
        : step.previousStep;

    if (prevStepId && prevStepId !== "[Function]") {
      // --- THIS IS THE FIX ---
      // If end.previousStep = start, we want an edge FROM "end" TO "start".
      edges.push({
        id: `${sourceId}-prev-${prevStepId}`,
        source: sourceId, // The step that has the property is the source.
        target: String(prevStepId), // The property's value is the target.
        sourceHandle: "previous", // The edge comes from the gray "previous" handle.
        type: "conditional",
        data: {
          edgeType: "previous",
          label: "Back",
        },
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

// This function correctly interprets the visual model created above.
export function convertFlowToSteps<
  TContext extends OnboardingContext = OnboardingContext,
>(
  nodes: StepNode[],
  edges: ConditionalFlowEdge[],
  originalSteps?: OnboardingStep<TContext>[],
): OnboardingStep<TContext>[] {
  const steps: OnboardingStep<TContext>[] = [];

  nodes.forEach((node) => {
    const { stepId, stepType } = node.data;
    const originalStep = originalSteps?.find((s) => s.id === stepId);
    const step: OnboardingStep<TContext> = originalStep
      ? { ...originalStep }
      : ({
          id: stepId,
          type: stepType,
          payload: getDefaultPayload(stepType) as any,
        } as OnboardingStep<TContext>);

    // Find edges where THIS node is the SOURCE
    const nextEdges = edges.filter(
      (e) =>
        e.source === node.id &&
        (e.data?.edgeType === "next" || !e.data?.edgeType),
    );
    const skipEdges = edges.filter(
      (e) => e.source === node.id && e.data?.edgeType === "skip",
    );
    const prevEdges = edges.filter(
      (e) => e.source === node.id && e.data?.edgeType === "previous",
    );

    // Reset navigation properties
    step.nextStep = undefined;
    step.previousStep = undefined;
    step.isSkippable = skipEdges.length > 0;
    (step as any).skipToStep = undefined;

    // Set navigation properties based on outgoing edges
    if (nextEdges.length > 0) {
      const targetNode = nodes.find((n) => n.id === nextEdges[0].target);
      if (targetNode) step.nextStep = targetNode.data.stepId as any;
    }

    if (skipEdges.length > 0) {
      const targetNode = nodes.find((n) => n.id === skipEdges[0].target);
      if (targetNode) {
        step.isSkippable = true;
        (step as any).skipToStep = targetNode.data.stepId;
      }
    }

    // If this node is the SOURCE of a "previous" edge, its previousStep is the TARGET.
    if (prevEdges.length > 0) {
      const targetNode = nodes.find((n) => n.id === prevEdges[0].target);
      if (targetNode) step.previousStep = targetNode.data.stepId as any;
    }

    steps.push(step);
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
