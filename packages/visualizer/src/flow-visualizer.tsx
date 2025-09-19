'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
    ReactFlow,
    Node,
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
import { TypeScriptExporter, TypeScriptExportOptions } from './utils/typescript-exporter'
import { StepNode } from './nodes/step-node'
import { EndNode } from './nodes/end-node'
import { ConditionalEdge, ConditionalFlowEdge } from './edges/conditional-edge'
import { FlowToolbar, ExportFormat } from './components/flow-toolbar'
import { FlowSidebar } from './components/flow-sidebar'
import { StepDetailsPanel } from './components/step-details-panel'
import { ConditionalFlowMode } from './components/conditional-flow-mode'
import { convertStepsToFlow, convertFlowToSteps, layoutNodes } from './utils/flow-converters'
import './flow-visualizer.css'
import '../styles.css'
import { getStepTypeColor } from './utils/colors.utils'
import { generateStepId, getDefaultPayload } from './utils/step.utils'

// Define custom node and edge types
const nodeTypes: NodeTypes = {
    stepNode: StepNode,
    endNode: EndNode,
}

const edgeTypes: EdgeTypes = {
    conditional: ConditionalEdge,
}

interface FlowVisualizerProps<TContext extends OnboardingContext = OnboardingContext> {
    initialSteps?: OnboardingStep<TContext>[]
    onStepsChange?: (steps: OnboardingStep<TContext>[]) => void
    onExport?: (content: string, format: ExportFormat, filename: string) => void
    onImport?: (steps: OnboardingStep<TContext>[]) => void
    readonly?: boolean
    className?: string
}

export function FlowVisualizer<TContext extends OnboardingContext = OnboardingContext>({
    initialSteps = [],
    onStepsChange,
    onExport,
    onImport,
    readonly = false,
    className = '',
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
    )
}

function FlowVisualizerInner<TContext extends OnboardingContext = OnboardingContext>({
    initialSteps = [],
    onStepsChange,
    onExport,
    onImport,
    readonly = false,
    className = '',
}: FlowVisualizerProps<TContext>) {
    // State
    const [steps, setSteps] = useState<OnboardingStep<TContext>[]>(initialSteps)
    const [selectedStep, setSelectedStep] = useState<OnboardingStep<TContext> | null>(null)

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [detailsPanelOpen, setDetailsPanelOpen] = useState(false)
    const [conditionalModeOpen, setConditionalModeOpen] = useState(false)
    const [edgeVisibility, setEdgeVisibility] = useState({
        next: true,
        conditional: true,
        skip: true,
        previous: true,
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

    const stepsById = useMemo(() => {
        return new Map(steps.map((step) => [step.id, step]))
    }, [steps])

    const fileInputRef = useRef<HTMLInputElement>(null)

    // Convert steps to flow data (preserve positions if nodes already exist)
    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => convertStepsToFlow(steps), [])

    // Filter edges based on visibility settings
    const visibleEdges = useMemo(() => {
        return initialEdges.filter((edge) => {
            const edgeType = edge.data?.edgeType || 'next'
            return edgeVisibility[edgeType as keyof typeof edgeVisibility]
        })
    }, [initialEdges, edgeVisibility])

    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(visibleEdges)

    const { fitView, getNodes, getEdges } = useReactFlow<StepNode | EndNode, ConditionalFlowEdge>()

    // Update flow when steps change
    useEffect(() => {
        const { nodes: newNodes, edges: newEdges } = convertStepsToFlow(steps, {
            existingNodes: nodes,
        })
        const filteredEdges = newEdges.filter((edge) => {
            const edgeType = edge.data?.edgeType || 'next'
            return edgeVisibility[edgeType as keyof typeof edgeVisibility]
        })
        setNodes(newNodes)
        setEdges(filteredEdges)
    }, [steps, edgeVisibility, setNodes, setEdges])

    const updateStepsFromFlow = useCallback(
        (newNodes?: (StepNode | EndNode)[], newEdges?: ConditionalFlowEdge[]) => {
            if (readonly) {
                return { updatedSteps: steps, updatedNodes: nodes, updatedEdges: edges }
            }

            const currentNodes = newNodes ?? nodes
            const currentEdges = newEdges ?? edges

            // Pass current steps to preserve payload data
            const newSteps = convertFlowToSteps<TContext>(currentNodes, currentEdges)

            setSteps(newSteps)
            onStepsChange?.(newSteps)

            return { updatedSteps: newSteps, updatedNodes: currentNodes, updatedEdges: currentEdges }
        },
        [readonly, getNodes, getEdges, onStepsChange, steps, nodes, edges]
    )

    const onConnect = useCallback(
        (params: Connection) => {
            console.log('onConnect', params)

            if (readonly) return

            // Determine edge type based on source handle
            let edgeType: 'next' | 'skip' | 'previous' = 'next'
            let label = 'Next'
            let markerEnd: { type: MarkerType } | undefined = {
                type: MarkerType.ArrowClosed,
            }
            let markerStart: { type: MarkerType } | undefined = undefined

            if (params.sourceHandle === 'skip') {
                edgeType = 'skip'
                label = 'Skip'
            } else if (params.sourceHandle === 'previous') {
                edgeType = 'previous'
                label = 'Back'
                markerEnd = undefined // No arrow for previous edges
                markerStart = { type: MarkerType.ArrowClosed }
            }

            const newEdge: ConditionalFlowEdge = {
                id: `edge-${params.source}-${edgeType}-${params.target}`,
                ...params,
                markerStart,
                markerEnd,
                type: 'conditional',
                data: {
                    edgeType,
                    label,
                },
            }

            // Prevent multiple outgoing edges of the same type from a single node
            const filteredEdges = edges.filter((e) => e.source !== params.source && e.data?.edgeType === edgeType)

            updateStepsFromFlow(undefined, [...filteredEdges, newEdge])
        },
        [readonly, steps, updateStepsFromFlow]
    )

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: StepNode | EndNode) => {
            // Only handle clicks on StepNode, not EndNode
            if (node.type === 'stepNode') {
                const step = steps.find((s) => s.id === node.data.stepId)
                if (step) {
                    setSelectedStep(step)
                    setDetailsPanelOpen(true)
                }
            }
        },
        [steps]
    )

    const onNodesDelete = useCallback(
        (nodesToDelete: Node[]) => {
            if (readonly) return

            // Filter out END nodes and only delete step nodes
            const stepNodesToDelete = nodesToDelete.filter((node) => node.type === 'stepNode')
            const stepIdsToDelete = new Set(stepNodesToDelete.map((node) => (node as StepNode).data.stepId))
            const newSteps = steps.filter((step) => !stepIdsToDelete.has(step.id))

            setSteps(newSteps)
            onStepsChange?.(newSteps)
        },
        [readonly, steps, onStepsChange]
    )

    const onEdgesDelete = useCallback(
        (edgesToDelete: Edge[]) => {
            if (readonly) return

            const edgeIdsToDelete = new Set(edgesToDelete.map((edge) => edge.id))
            const remainingEdges = edges.filter((edge) => !edgeIdsToDelete.has(edge.id))

            // Update steps with the remaining edges
            updateStepsFromFlow(undefined, remainingEdges)
        },
        [readonly, updateStepsFromFlow]
    )

    // Step management (keeping existing functions)
    const addStep = useCallback(
        (stepType: OnboardingStep<TContext>['type'] = 'INFORMATION') => {
            if (readonly) return

            const newId = generateStepId()
            const newStep: OnboardingStep<TContext> = {
                id: newId,
                type: stepType,
                payload: getDefaultPayload(stepType),
            } as OnboardingStep<TContext>

            const newSteps = [...steps, newStep]
            setSteps(newSteps)
            onStepsChange?.(newSteps)
        },
        [readonly, steps, onStepsChange]
    )

    const updateStep = useCallback(
        (updatedStep: OnboardingStep<TContext>) => {
            if (readonly) return

            // Handle ID changes: find step by checking if it's the currently selected step
            // or by comparing the original ID if it hasn't changed
            const newSteps = steps.map((step) => {
                if (selectedStep && step.id === selectedStep.id) {
                    // This is the step being edited, update it with the new data
                    return updatedStep
                } else if (step.id === updatedStep.id) {
                    // ID hasn't changed, normal update
                    return updatedStep
                }
                return step
            })

            setSteps(newSteps)
            onStepsChange?.(newSteps)
            setSelectedStep(updatedStep)
        },
        [readonly, steps, onStepsChange, selectedStep]
    )

    const deleteStep = useCallback(
        (stepId: string | number) => {
            if (readonly) return

            const newSteps = steps.filter((step) => step.id !== stepId)
            setSteps(newSteps)
            onStepsChange?.(newSteps)

            if (selectedStep?.id === stepId) {
                setSelectedStep(null)
                setDetailsPanelOpen(false)
            }
        },
        [readonly, steps, onStepsChange, selectedStep]
    )

    const layoutFlow = useCallback(
        (direction: 'TB' | 'LR' = 'TB') => {
            const layoutedElements = layoutNodes<StepNode | EndNode, ConditionalFlowEdge>(
                getNodes(),
                getEdges(),
                direction
            )
            setNodes(layoutedElements.nodes)
            setEdges(layoutedElements.edges)

            // Fit view after layout
            setTimeout(() => fitView(), 100)
        },
        [getNodes, getEdges, setNodes, setEdges, fitView]
    )

    // Updated Import/Export functionality
    const exportFlow = useCallback(
        (format: ExportFormat) => {
            if (format === 'json') {
                const result = StepJSONParser.toJSON(steps, exportOptions)

                if (result.success && result.data) {
                    const filename = 'onboarding-flow.json'
                    onExport?.(result.data, format, filename)

                    // Also trigger file download
                    downloadFile(result.data, filename, 'application/json')
                } else {
                    alert(`JSON export failed: ${result.errors.join(', ')}`)
                }
            } else if (format === 'typescript') {
                const result = TypeScriptExporter.exportToTypeScript<TContext>(steps, typeScriptExportOptions)

                if (result.success && result.code) {
                    const filename = 'onboarding-steps.ts'
                    onExport?.(result.code, format, filename)

                    // Also trigger file download
                    downloadFile(result.code, filename, 'text/typescript')
                } else {
                    alert(`TypeScript export failed: ${result.errors.join(', ')}`)
                }
            }
        },
        [steps, exportOptions, typeScriptExportOptions, onExport]
    )

    const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }, [])

    const importFlow = useCallback(
        (file?: File) => {
            if (readonly) return

            if (file) {
                handleFileImport(file)
            } else {
                fileInputRef.current?.click()
            }
        },
        [readonly]
    )

    const handleFileImport = useCallback(
        async (file: File) => {
            try {
                const jsonString = await file.text()
                const result = StepJSONParser.fromJSON<TContext>(jsonString, exportOptions as StepJSONParserOptions)

                if (result.success && result.data) {
                    setSteps(result.data)
                    onStepsChange?.(result.data)
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
        [exportOptions, onStepsChange, onImport, layoutFlow]
    )

    const clearFlow = useCallback(() => {
        if (readonly) return

        if (confirm('Are you sure you want to clear the entire flow?')) {
            setSteps([])
            onStepsChange?.([])
            setSelectedStep(null)
            setDetailsPanelOpen(false)
        }
    }, [readonly, onStepsChange])

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
                onToggleConditionalMode={() => setConditionalModeOpen(!conditionalModeOpen)}
                isConditionalMode={conditionalModeOpen}
                exportOptions={exportOptions}
                onExportOptionsChange={setExportOptions}
                typeScriptExportOptions={typeScriptExportOptions}
                onTypeScriptExportOptionsChange={setTypeScriptExportOptions}
                readonly={readonly}
                stepCount={steps.length}
            />

            {/* Main flow area */}
            <div className="flow-container">
                {/* Conditional Flow Mode */}
                {conditionalModeOpen && (
                    <div className="absolute top-4 left-4 z-10 max-w-md">
                        <ConditionalFlowMode
                            steps={steps}
                            onStepsChange={(newSteps) => {
                                setSteps(newSteps)
                                onStepsChange?.(newSteps)
                            }}
                            isActive={conditionalModeOpen}
                            onToggle={() => setConditionalModeOpen(!conditionalModeOpen)}
                            readonly={readonly}
                        />
                    </div>
                )}

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
                        type: 'conditional',
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
                        nodeColor={(node) => getStepTypeColor((node as StepNode).data.stepType || 'endNode')}
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
                                Sequential
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
                        </div>
                    </div>
                </ReactFlow>

                {/* Sidebar */}
                {sidebarOpen && (
                    <FlowSidebar
                        steps={steps}
                        onStepSelect={(step) => {
                            setSelectedStep(step)
                            setDetailsPanelOpen(true)
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

                {/* Conditional Flow Mode */}
                {conditionalModeOpen && (
                    <div className="absolute top-4 left-4 z-40">
                        <ConditionalFlowMode
                            steps={steps}
                            onStepsChange={(newSteps) => {
                                setSteps(newSteps)
                                onStepsChange?.(newSteps)
                            }}
                            isActive={conditionalModeOpen}
                            onToggle={() => setConditionalModeOpen(false)}
                            defaultCondition={(context) => context.flowData?.userRole === 'admin'}
                            readonly={readonly}
                        />
                    </div>
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
                    }
                    e.target.value = ''
                }}
            />
        </div>
    )
}
