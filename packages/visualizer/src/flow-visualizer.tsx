"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  ConnectionLineType,
  MarkerType,
  Connection,
  ReactFlowProvider,
  NodeTypes,
  EdgeTypes,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { OnboardingStep, OnboardingContext } from "@onboardjs/core";
import { StepJSONParser, StepJSONParserOptions } from "@onboardjs/core";
import {
  TypeScriptExporter,
  TypeScriptExportOptions,
} from "./utils/typescript-exporter";
import { StepNode } from "./nodes/step-node";
import { ConditionalEdge, ConditionalFlowEdge } from "./edges/conditional-edge";
import { FlowToolbar, ExportFormat } from "./components/flow-toolbar";
import { FlowSidebar } from "./components/flow-sidebar";
import { StepDetailsPanel } from "./components/step-details-panel";
import {
  convertStepsToFlow,
  convertFlowToSteps,
  layoutNodes,
} from "./utils/flow-converters";
import "./flow-visualizer.css";

// Define custom node and edge types
const nodeTypes: NodeTypes = {
  stepNode: StepNode,
};

const edgeTypes: EdgeTypes = {
  conditional: ConditionalEdge,
};

interface FlowVisualizerProps<
  TContext extends OnboardingContext = OnboardingContext,
> {
  initialSteps?: OnboardingStep<TContext>[];
  onStepsChange?: (steps: OnboardingStep<TContext>[]) => void;
  onExport?: (content: string, format: ExportFormat, filename: string) => void;
  onImport?: (steps: OnboardingStep<TContext>[]) => void;
  readonly?: boolean;
  className?: string;
}

export function FlowVisualizer<
  TContext extends OnboardingContext = OnboardingContext,
>({
  initialSteps = [],
  onStepsChange,
  onExport,
  onImport,
  readonly = false,
  className = "",
}: FlowVisualizerProps<TContext>) {
  return (
    <ReactFlowProvider>
      <FlowVisualizerInner
        initialSteps={initialSteps}
        onStepsChange={onStepsChange}
        onExport={onExport}
        onImport={onImport}
        readonly={readonly}
        className={className}
      />
    </ReactFlowProvider>
  );
}

function FlowVisualizerInner<
  TContext extends OnboardingContext = OnboardingContext,
>({
  initialSteps = [],
  onStepsChange,
  onExport,
  onImport,
  readonly = false,
  className = "",
}: FlowVisualizerProps<TContext>) {
  // State
  const [steps, setSteps] = useState<OnboardingStep<TContext>[]>(initialSteps);
  const [selectedStep, setSelectedStep] =
    useState<OnboardingStep<TContext> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<
    Partial<StepJSONParserOptions>
  >({
    prettyPrint: true,
    functionHandling: "serialize",
    includeMeta: true,
    validateSteps: true,
  });
  const [typeScriptExportOptions, setTypeScriptExportOptions] = useState<
    Partial<TypeScriptExportOptions>
  >({
    includeImports: true,
    includeTypes: true,
    useConstAssertion: true,
    variableName: "onboardingSteps",
    includeComments: true,
    inlineFunctions: false,
    indentation: "spaces",
    spacesCount: 2,
    includeValidation: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert steps to flow data
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => convertStepsToFlow(steps),
    [steps],
  );

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const { fitView, getNodes, getEdges } = useReactFlow<
    StepNode,
    ConditionalFlowEdge
  >();

  // Update flow when steps change
  React.useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = convertStepsToFlow(steps);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [steps, setNodes, setEdges]);

  const updateStepsFromFlow = useCallback(
    (nodes?: StepNode[], edges?: ConditionalFlowEdge[]) => {
      if (readonly) return;

      const currentNodes = nodes || getNodes();
      const currentEdges = edges || getEdges();

      console.log("Updating steps from flow data", {
        currentNodes,
        currentEdges,
      });

      // Pass current steps to preserve payload data
      const newSteps = convertFlowToSteps<TContext>(
        currentNodes,
        currentEdges,
        steps,
      );

      setSteps(newSteps);
      onStepsChange?.(newSteps);
    },
    [readonly, getNodes, getEdges, onStepsChange, steps],
  );

  // Fixed onConnect to detect edge type from source handle
  const onConnect = useCallback(
    (params: Connection) => {
      if (readonly) return;

      // Determine edge type based on source handle
      let edgeType: "next" | "skip" | "previous" = "next";
      let label = "Next";
      let markerEnd: { type: MarkerType } | undefined = {
        type: MarkerType.ArrowClosed,
      };
      let markerStart: { type: MarkerType } | undefined = undefined;

      if (params.sourceHandle === "skip") {
        edgeType = "skip";
        label = "Skip";
      } else if (params.sourceHandle === "previous") {
        edgeType = "previous";
        label = "Back";
        markerEnd = undefined; // No arrow for previous edges
        markerStart = { type: MarkerType.ArrowClosed };
      }

      const newEdge: ConditionalFlowEdge = {
        id: `edge-${params.source}-${params.target}-${edgeType}`,
        ...params,
        markerStart,
        markerEnd,
        type: "conditional",
        data: {
          edgeType,
          label,
        },
      };

      console.log("Adding new edge", newEdge);

      setEdges((currentEdges) => {
        const updatedEdges = addEdge(newEdge, currentEdges);

        // Update steps with the new edges immediately
        setTimeout(() => {
          updateStepsFromFlow(getNodes(), updatedEdges);
        }, 0);

        return updatedEdges;
      });
    },
    [readonly, setEdges, getNodes, updateStepsFromFlow],
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: StepNode) => {
      const step = steps.find((s) => s.id === node.data.stepId);
      if (step) {
        console.log("Node clicked", step);

        setSelectedStep(step);
        setDetailsPanelOpen(true);
      }
    },
    [steps],
  );

  const onNodesDelete = useCallback(
    (nodesToDelete: Node[]) => {
      if (readonly) return;

      const stepIdsToDelete = new Set(
        nodesToDelete.map((node) => node.data.stepId),
      );
      const newSteps = steps.filter((step) => !stepIdsToDelete.has(step.id));

      setSteps(newSteps);
      onStepsChange?.(newSteps);
    },
    [readonly, steps, onStepsChange],
  );

  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      if (readonly) return;

      const edgeIdsToDelete = new Set(edgesToDelete.map((edge) => edge.id));
      const currentEdges = getEdges();
      const remainingEdges = currentEdges.filter(
        (edge) => !edgeIdsToDelete.has(edge.id),
      );

      console.log("Deleting edges", { edgesToDelete, remainingEdges });

      // Update steps with the remaining edges
      updateStepsFromFlow(getNodes(), remainingEdges);
    },
    [readonly, getNodes, getEdges, updateStepsFromFlow],
  );

  // Step management (keeping existing functions)
  const addStep = useCallback(
    (stepType: OnboardingStep<TContext>["type"] = "INFORMATION") => {
      if (readonly) return;

      const newId = `step_${Date.now()}`;
      const newStep: OnboardingStep<TContext> = {
        id: newId,
        type: stepType,
        payload:
          stepType === "SINGLE_CHOICE"
            ? { options: [] }
            : stepType === "MULTIPLE_CHOICE"
              ? { options: [] }
              : stepType === "CHECKLIST"
                ? { dataKey: `${newId}_data`, items: [] }
                : stepType === "CUSTOM_COMPONENT"
                  ? { componentKey: "DefaultComponent" }
                  : {},
      } as OnboardingStep<TContext>;

      const newSteps = [...steps, newStep];
      setSteps(newSteps);
      onStepsChange?.(newSteps);
    },
    [readonly, steps, onStepsChange],
  );

  const updateStep = useCallback(
    (updatedStep: OnboardingStep<TContext>) => {
      if (readonly) return;

      console.log("Updating step", updatedStep);
      

      const newSteps = steps.map((step) =>
        step.id === updatedStep.id ? updatedStep : step,
      );

      setSteps(newSteps);
      onStepsChange?.(newSteps);
      setSelectedStep(updatedStep);
    },
    [readonly, steps, onStepsChange],
  );

  const deleteStep = useCallback(
    (stepId: string | number) => {
      if (readonly) return;

      const newSteps = steps.filter((step) => step.id !== stepId);
      setSteps(newSteps);
      onStepsChange?.(newSteps);

      if (selectedStep?.id === stepId) {
        setSelectedStep(null);
        setDetailsPanelOpen(false);
      }
    },
    [readonly, steps, onStepsChange, selectedStep],
  );

  const layoutFlow = useCallback(
    (direction: "TB" | "LR" = "TB") => {
      const layoutedElements = layoutNodes<StepNode, ConditionalFlowEdge>(
        getNodes(),
        getEdges(),
        direction,
      );
      setNodes(layoutedElements.nodes);
      setEdges(layoutedElements.edges);

      // Fit view after layout
      setTimeout(() => fitView(), 100);
    },
    [getNodes, getEdges, setNodes, setEdges, fitView],
  );

  // Updated Import/Export functionality
  const exportFlow = useCallback(
    (format: ExportFormat) => {
      if (format === "json") {
        const result = StepJSONParser.toJSON(steps, exportOptions);

        if (result.success && result.data) {
          const filename = "onboarding-flow.json";
          onExport?.(result.data, format, filename);

          // Also trigger file download
          downloadFile(result.data, filename, "application/json");
        } else {
          alert(`JSON export failed: ${result.errors.join(", ")}`);
        }
      } else if (format === "typescript") {
        const result = TypeScriptExporter.exportToTypeScript<TContext>(
          steps,
          typeScriptExportOptions,
        );

        if (result.success && result.code) {
          const filename = "onboarding-steps.ts";
          onExport?.(result.code, format, filename);

          // Also trigger file download
          downloadFile(result.code, filename, "text/typescript");
        } else {
          alert(`TypeScript export failed: ${result.errors.join(", ")}`);
        }
      }
    },
    [steps, exportOptions, typeScriptExportOptions, onExport],
  );

  const downloadFile = useCallback(
    (content: string, filename: string, mimeType: string) => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [],
  );

  const importFlow = useCallback(
    (file?: File) => {
      if (readonly) return;

      if (file) {
        handleFileImport(file);
      } else {
        fileInputRef.current?.click();
      }
    },
    [readonly],
  );

  const handleFileImport = useCallback(
    async (file: File) => {
      try {
        const jsonString = await file.text();
        const result = StepJSONParser.fromJSON<TContext>(
          jsonString,
          exportOptions as StepJSONParserOptions,
        );

        if (result.success && result.data) {
          setSteps(result.data);
          onStepsChange?.(result.data);
          onImport?.(result.data);

          // Layout the imported flow
          setTimeout(() => layoutFlow(), 100);
        } else {
          alert(`Import failed: ${result.errors.join(", ")}`);
        }
      } catch (error) {
        alert(
          `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [exportOptions, onStepsChange, onImport, layoutFlow],
  );

  const clearFlow = useCallback(() => {
    if (readonly) return;

    if (confirm("Are you sure you want to clear the entire flow?")) {
      setSteps([]);
      onStepsChange?.([]);
      setSelectedStep(null);
      setDetailsPanelOpen(false);
    }
  }, [readonly, onStepsChange]);

  return (
    <div className={`flow-visualizer ${className}`}>
      {/* Updated Toolbar */}
      <FlowToolbar
        onAddStep={addStep}
        onExport={exportFlow}
        onImport={() => importFlow()}
        onClear={clearFlow}
        onLayout={layoutFlow}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        exportOptions={exportOptions}
        onExportOptionsChange={setExportOptions}
        typeScriptExportOptions={typeScriptExportOptions}
        onTypeScriptExportOptionsChange={setTypeScriptExportOptions}
        readonly={readonly}
        stepCount={steps.length}
      />

      {/* Main flow area */}
      <div className="flow-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          defaultEdgeOptions={{
            markerEnd: { type: MarkerType.ArrowClosed },
            type: "conditional",
          }}
          fitView
          deleteKeyCode="Delete"
          multiSelectionKeyCode="Shift"
          panOnScroll
          selectionOnDrag
          panOnDrag={[1, 2]}
          selectNodesOnDrag={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const stepType = (node.data?.stepType as any) || "INFORMATION";
              return getStepTypeColor(stepType);
            }}
            nodeStrokeWidth={3}
            zoomable
            pannable
          />
        </ReactFlow>

        {/* Sidebar */}
        {sidebarOpen && (
          <FlowSidebar
            steps={steps}
            onStepSelect={(step) => {
              setSelectedStep(step);
              setDetailsPanelOpen(true);
            }}
            onStepAdd={addStep}
            onStepDelete={deleteStep}
            onClose={() => setSidebarOpen(false)}
            readonly={readonly}
          />
        )}

        {/* Details Panel */}
        {detailsPanelOpen && selectedStep && (
          <StepDetailsPanel
            step={selectedStep}
            onStepUpdate={updateStep}
            onClose={() => setDetailsPanelOpen(false)}
            readonly={readonly}
          />
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileImport(file);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}

// Helper function for step type colors (keeping existing)
function getStepTypeColor(stepType: string): string {
  switch (stepType) {
    case "INFORMATION":
      return "#3b82f6";
    case "SINGLE_CHOICE":
      return "#10b981";
    case "MULTIPLE_CHOICE":
      return "#8b5cf6";
    case "CHECKLIST":
      return "#f59e0b";
    case "CONFIRMATION":
      return "#ef4444";
    case "CUSTOM_COMPONENT":
      return "#6b7280";
    default:
      return "#3b82f6";
  }
}
