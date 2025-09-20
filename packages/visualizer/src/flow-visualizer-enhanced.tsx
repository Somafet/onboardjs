'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
    ReactFlow,
    Edge,
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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import { StepJSONParser, StepJSONParserOptions } from '@onboardjs/core'
import { TypeScriptExportOptions } from './utils/typescript-exporter'
import { StepNode } from './nodes/step-node'
import { EndNode } from './nodes/end-node'
import { ConditionNode } from './nodes/condition-node'
import { ConditionalEdge, ConditionalFlowEdge } from './edges/conditional-edge'
import { FlowToolbar } from './components/flow-toolbar'
import { FlowSidebar } from './components/flow-sidebar'
import { StepDetailsPanel } from './components/step-details-panel'
import {
    FlowState,
    stepsToFlowState,
    exportFlowAsSteps,
    exportFlowAsCode,
    EnhancedStepNode,
    EnhancedConditionNode,
    layoutNodes,
} from './utils/flow-converters'
import './flow-visualizer.css'
import '../styles.css'
import { getStepTypeColor } from './utils/colors.utils'
import { ExportFormat } from './types'

// Define custom node and edge types
const nodeTypes: NodeTypes = {
    stepNode: StepNode,
    endNode: EndNode,
    conditionNode: ConditionNode,
}

const edgeTypes: EdgeTypes = {
    conditional: ConditionalEdge,
}

interface FlowVisualizerEnhancedProps<TContext extends OnboardingContext = OnboardingContext> {
    initialSteps?: OnboardingStep<TContext>[]
    onStepsChange?: (steps: OnboardingStep<TContext>[]) => void
    onExport?: (content: string, format: ExportFormat, filename: string) => void
    onImport?: (steps: OnboardingStep<TContext>[]) => void
    readonly?: boolean
    className?: string
}

export function FlowVisualizerEnhanced<TContext extends OnboardingContext = OnboardingContext>({
    initialSteps = [],
    onStepsChange,
    onExport,
    onImport,
    readonly = false,
    className = '',
}: FlowVisualizerEnhancedProps<TContext>) {
    return (
        <ReactFlowProvider>
            <FlowVisualizerEnhancedInner
                initialSteps={initialSteps}
                onStepsChange={onStepsChange}
                onExport={onExport}
                onImport={onImport}
                readonly={readonly}
                className={className}
            />
        </ReactFlowProvider>
    )
}

function FlowVisualizerEnhancedInner<TContext extends OnboardingContext = OnboardingContext>({
    initialSteps = [],
    onStepsChange,
    onExport,
    onImport,
    readonly = false,
    className = '',
}: FlowVisualizerEnhancedProps<TContext>) {
    // State - Use FlowState as single source of truth
    const [flowState, setFlowState] = useState<FlowState>(() => stepsToFlowState(initialSteps))
    const [selectedStep, setSelectedStep] = useState<OnboardingStep<TContext> | null>(null)
    const [selectedConditionNode, setSelectedConditionNode] = useState<ConditionNode | null>(null)

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [detailsPanelOpen, setDetailsPanelOpen] = useState(false)
    const [conditionalModeOpen, setConditionalModeOpen] = useState(false)
    const [edgeVisibility, setEdgeVisibility] = useState({
        next: true,
        conditional: true,
        skip: true,
        previous: true,
        then: true,
        else: true,
    })
    const [exportOptions, setExportOptions] = useState<Partial<StepJSONParserOptions>>({
        prettyPrint: true,
        functionHandling: 'serialize',
        includeMeta: true,
        validateSteps: true,
    })
    const [typeScriptExportOptions, setTypeScriptExportOptions] = useState<Partial<TypeScriptExportOptions>>({
        includeImports: false,
        includeTypes: false,
        useConstAssertion: false,
        variableName: 'steps',
        includeComments: true,
        inlineFunctions: true,
        indentation: 'spaces',
        spacesCount: 2,
        includeValidation: false,
    })

    // Derive steps from flow state when needed for backwards compatibility
    const steps = useMemo(() => exportFlowAsSteps<TContext>(flowState), [flowState])

    const stepsById = useMemo(() => {
        return new Map(steps.map((step) => [step.id, step]))
    }, [steps])

    const fileInputRef = useRef<HTMLInputElement>(null)

    // Use flow state directly for nodes and edges
    const { nodes: flowNodes, edges: flowEdges } = flowState

    // Filter edges based on visibility settings
    const visibleEdges = useMemo(() => {
        return flowEdges.filter((edge) => {
            const edgeType = edge.data?.edgeType || 'next'
            return edgeVisibility[edgeType as keyof typeof edgeVisibility]
        })
    }, [flowEdges, edgeVisibility])

    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(visibleEdges)

    const { fitView, getNodes, getEdges, screenToFlowPosition } = useReactFlow<
        EnhancedStepNode | EndNode | EnhancedConditionNode,
        ConditionalFlowEdge
    >()

    // Update React Flow when flowState changes
    useEffect(() => {
        setNodes(flowState.nodes)
        setEdges(visibleEdges)
    }, [flowState, visibleEdges, setNodes, setEdges])

    // Update flow state when steps change externally
    useEffect(() => {
        if (initialSteps !== steps) {
            setFlowState(stepsToFlowState(initialSteps))
        }
    }, [initialSteps])

    // Notify parent when steps change
    useEffect(() => {
        onStepsChange?.(steps)
    }, [steps, onStepsChange])

    const updateFlowState = useCallback((newFlowState: FlowState) => {
        setFlowState(newFlowState)
    }, [])

    // Handle node connections
    const onConnect = useCallback(
        (connection: Connection) => {
            if (readonly) return

            const { source, target, sourceHandle, targetHandle } = connection

            if (!source || !target) return

            // Determine edge type based on source handle
            const edgeType =
                sourceHandle === 'skip'
                    ? 'skip'
                    : sourceHandle === 'previous'
                      ? 'previous'
                      : sourceHandle === 'then'
                        ? 'then'
                        : sourceHandle === 'else'
                          ? 'else'
                          : 'next'

            const newEdge: ConditionalFlowEdge = {
                id: `${source}-${edgeType}-${target}`,
                source,
                target,
                sourceHandle: sourceHandle || 'next',
                targetHandle: targetHandle || undefined,
                type: 'conditional',
                data: {
                    edgeType: edgeType as any,
                    label: edgeType.charAt(0).toUpperCase() + edgeType.slice(1),
                },
            }

            const newFlowState: FlowState = {
                nodes: flowState.nodes,
                edges: [...flowState.edges, newEdge],
            }

            updateFlowState(newFlowState)
        },
        [readonly, flowState, updateFlowState]
    )

    const onEdgesDelete = useCallback(
        (edgesToDelete: Edge[]) => {
            if (readonly) return

            const edgeIdsToDelete = new Set(edgesToDelete.map((edge) => edge.id))
            const remainingEdges = flowState.edges.filter((edge) => !edgeIdsToDelete.has(edge.id))

            const newFlowState: FlowState = {
                nodes: flowState.nodes,
                edges: remainingEdges,
            }

            updateFlowState(newFlowState)
        },
        [readonly, flowState, updateFlowState]
    )

    // Layout flow
    const layoutFlow = useCallback(
        (direction: 'TB' | 'LR' = 'TB') => {
            const layoutedElements = layoutNodes<(typeof flowNodes)[0], ConditionalFlowEdge>(
                flowState.nodes,
                flowState.edges,
                direction
            )

            const newFlowState: FlowState = {
                nodes: layoutedElements.nodes,
                edges: layoutedElements.edges,
            }

            updateFlowState(newFlowState)

            // Fit view after layout
            setTimeout(() => fitView(), 100)
        },
        [flowState, updateFlowState, fitView]
    )

    // Export functionality
    const exportFlow = useCallback(
        (format: ExportFormat) => {
            if (format === 'json') {
                const result = StepJSONParser.toJSON(steps, exportOptions)
                if (result.success && result.data) {
                    onExport?.(result.data, format, 'onboarding-flow.json')
                }
            } else if (format === 'typescript') {
                const code = exportFlowAsCode(flowState, {
                    format: 'typescript',
                    includeTypes: typeScriptExportOptions.includeTypes,
                    includeComments: typeScriptExportOptions.includeComments,
                    variableName: typeScriptExportOptions.variableName,
                })
                onExport?.(code, format, 'onboarding-flow.ts')
            } else if (format === 'javascript') {
                const code = exportFlowAsCode(flowState, {
                    format: 'javascript',
                    includeTypes: false,
                    includeComments: typeScriptExportOptions.includeComments,
                    variableName: typeScriptExportOptions.variableName,
                })
                onExport?.(code, format, 'onboarding-flow.js')
            }
        },
        [steps, exportOptions, typeScriptExportOptions, flowState, onExport]
    )

    // Handle file import
    const handleFileImport = useCallback(
        async (file: File) => {
            try {
                const jsonString = await file.text()
                const result = StepJSONParser.fromJSON<TContext>(jsonString, exportOptions as StepJSONParserOptions)

                if (result.success && result.data) {
                    const newFlowState = stepsToFlowState(result.data)
                    updateFlowState(newFlowState)
                    onImport?.(result.data)

                    // Layout the imported flow
                    setTimeout(() => layoutFlow(), 100)
                } else {
                    alert(`Import failed: ${result.errors.join(', ')}`)
                }
            } catch (error) {
                alert(`Import failed: ${error instanceof Error ? error.message : String(error)}`)
            }
        },
        [exportOptions, updateFlowState, onImport, layoutFlow]
    )

    return (
        <div className={`flow-visualizer ${className}`}>
            <div className="flow-container">
                {/* Toolbar */}
                <FlowToolbar
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    onLayout={layoutFlow}
                    onExport={exportFlow}
                    onClear={() => {}}
                    stepCount={steps.length}
                    onImport={() => fileInputRef.current?.click()}
                    onExportOptionsChange={setExportOptions}
                    onTypeScriptExportOptionsChange={setTypeScriptExportOptions}
                    exportOptions={exportOptions}
                    typeScriptExportOptions={typeScriptExportOptions}
                    readonly={readonly}
                />

                {/* React Flow */}
                <ReactFlow<EnhancedStepNode | EndNode | EnhancedConditionNode, ConditionalFlowEdge>
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onEdgesDelete={onEdgesDelete}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    connectionLineType={ConnectionLineType.Bezier}
                    defaultEdgeOptions={{
                        type: 'conditional',
                        markerEnd: { type: MarkerType.ArrowClosed },
                    }}
                    fitView
                    attributionPosition="top-right"
                    maxZoom={2}
                    minZoom={0.1}
                    selectNodesOnDrag={false}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background />
                    <Controls />
                    <MiniMap
                        nodeColor={(node) => getStepTypeColor((node as any).data.stepType || 'endNode')}
                        nodeStrokeWidth={3}
                        zoomable
                        pannable
                    />

                    {/* Edge Visibility Controls */}
                    <div className="edge-visibility-panel">
                        <div className="edge-visibility-header">
                            <h4>Edge Visibility</h4>
                        </div>
                        <div className="edge-visibility-controls">
                            <label className="edge-control">
                                <input
                                    type="checkbox"
                                    checked={edgeVisibility.next}
                                    onChange={(e) => setEdgeVisibility((prev) => ({ ...prev, next: e.target.checked }))}
                                />
                                <span className="edge-type-indicator next"></span>
                                Next
                            </label>
                            <label className="edge-control">
                                <input
                                    type="checkbox"
                                    checked={edgeVisibility.conditional}
                                    onChange={(e) =>
                                        setEdgeVisibility((prev) => ({ ...prev, conditional: e.target.checked }))
                                    }
                                />
                                <span className="edge-type-indicator conditional"></span>
                                Conditional
                            </label>
                            <label className="edge-control">
                                <input
                                    type="checkbox"
                                    checked={edgeVisibility.skip}
                                    onChange={(e) => setEdgeVisibility((prev) => ({ ...prev, skip: e.target.checked }))}
                                />
                                <span className="edge-type-indicator skip"></span>
                                Skip
                            </label>
                            <label className="edge-control">
                                <input
                                    type="checkbox"
                                    checked={edgeVisibility.previous}
                                    onChange={(e) =>
                                        setEdgeVisibility((prev) => ({ ...prev, previous: e.target.checked }))
                                    }
                                />
                                <span className="edge-type-indicator previous"></span>
                                Previous
                            </label>
                            <label className="edge-control">
                                <input
                                    type="checkbox"
                                    checked={edgeVisibility.then}
                                    onChange={(e) => setEdgeVisibility((prev) => ({ ...prev, then: e.target.checked }))}
                                />
                                <span className="edge-type-indicator then"></span>
                                Then
                            </label>
                            <label className="edge-control">
                                <input
                                    type="checkbox"
                                    checked={edgeVisibility.else}
                                    onChange={(e) => setEdgeVisibility((prev) => ({ ...prev, else: e.target.checked }))}
                                />
                                <span className="edge-type-indicator else"></span>
                                Else
                            </label>
                        </div>
                    </div>
                </ReactFlow>

                {/* Sidebar */}
                {sidebarOpen && (
                    <FlowSidebar
                        steps={steps}
                        onStepSelect={(step) => {
                            setSelectedStep(step)
                            setSelectedConditionNode(null)
                            setDetailsPanelOpen(true)
                        }}
                        onStepAdd={() => {}} // Simplified for demo
                        onStepDelete={() => {}} // Simplified for demo
                        onClose={() => setSidebarOpen(false)}
                        readonly={readonly}
                    />
                )}

                {/* Details Panel */}
                {detailsPanelOpen && selectedStep && (
                    <StepDetailsPanel
                        step={selectedStep}
                        onStepUpdate={() => {}} // Simplified for demo
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
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                        handleFileImport(file)
                        e.target.value = ''
                    }
                }}
            />
        </div>
    )
}
