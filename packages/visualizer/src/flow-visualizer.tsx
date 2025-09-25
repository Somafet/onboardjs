'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
    ReactFlow,
    Node,
    Edge,
    Controls,
    MiniMap,
    Background,
    ConnectionLineType,
    MarkerType,
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
import { ConditionalEdge, ConditionalFlowEdge } from './edges/conditional-edge'
import { FlowToolbar } from './components/flow-toolbar'
import { FlowSidebar } from './components/flow-sidebar'
import { NodePalette } from './components/node-palette'
import { StepDetailsPanel } from './components/step-details-panel'
import { ConditionDetailsPanel } from './components/condition-details-panel'

// Import from new modular structure
import { FlowState, EnhancedStepNode, EnhancedConditionNode, ExportFormat } from './types'
import { stepsToFlowState, exportFlowAsCode } from './converters'
import { layoutNodes, generateId, getDefaultPayload, getStepLabel, getStepDescription } from './utils'
import { getStepTypeColor } from './utils/colors.utils'
import { EndNode } from './nodes/end-node'
import { ConditionNode } from './nodes/condition-node'
import { EndNodeType, StepNodeType } from './types/node-types'

import './flow-visualizer.css'
import '../styles.css'
import { useFlowOperations, useFlowState } from './hooks'

// Define custom node and edge types
const nodeTypes: NodeTypes = {
    stepNode: StepNode,
    endNode: EndNode,
    conditionNode: ConditionNode,
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
    // State - Use FlowState as single source of truth
    const {
        flowState,
        updateFlowState,
        edges,
        nodes,
        setNodes,
        onNodesChange,
        onEdgesChange,
        steps,
        updateStepsFromFlow,
    } = useFlowState(initialSteps)

    const { addStep, deleteStep, updateNode, onConnect, updateConditionNode, isValidConnection } = useFlowOperations(
        flowState,
        updateFlowState,
        updateStepsFromFlow,
        readonly
    )

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [detailsPanelOpen, setDetailsPanelOpen] = useState(false)

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

    const fileInputRef = useRef<HTMLInputElement>(null)
    const isInitialMount = useRef(true)
    const lastInitialSteps = useRef(initialSteps)

    const { fitView, screenToFlowPosition } = useReactFlow<
        EnhancedStepNode | EndNodeType | EnhancedConditionNode,
        ConditionalFlowEdge
    >()

    // Notify parent when steps change
    useEffect(() => {
        onStepsChange?.(steps)
    }, [steps, onStepsChange])

    // Update flow state when initialSteps change externally (not during hot-reload)
    useEffect(() => {
        // Skip on initial mount - flowState is already initialized
        if (isInitialMount.current) {
            isInitialMount.current = false
            lastInitialSteps.current = initialSteps
            return
        }

        // Deep comparison of initialSteps to detect real changes
        const hasRealChange =
            initialSteps.length !== lastInitialSteps.current.length ||
            initialSteps.some((step, index) => {
                const lastStep = lastInitialSteps.current[index]
                return (
                    !lastStep ||
                    step.id !== lastStep.id ||
                    step.type !== lastStep.type ||
                    JSON.stringify(step.payload) !== JSON.stringify(lastStep.payload)
                )
            })

        if (hasRealChange) {
            lastInitialSteps.current = initialSteps
            const newFlowState = stepsToFlowState(initialSteps)
            updateFlowState(newFlowState)
        }
    }, [initialSteps, updateFlowState])

    // Get selected nodes from ReactFlow
    const selectedNodes = useMemo(() => {
        return nodes.filter((node) => node.selected)
    }, [nodes])

    // Get the currently selected step and condition nodes
    const selectedStepNode = selectedNodes.find((node): node is EnhancedStepNode => node.type === 'stepNode')
    const selectedConditionNode = selectedNodes.find(
        (node): node is EnhancedConditionNode => node.type === 'conditionNode'
    )

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: EnhancedStepNode | EndNodeType | EnhancedConditionNode) => {
            if (node.type === 'stepNode') {
                setDetailsPanelOpen(true)
            } else if (node.type === 'conditionNode') {
                setDetailsPanelOpen(true)
            }
        },
        []
    )

    const onNodesDelete = useCallback(
        (nodesToDelete: Node[]) => {
            if (readonly) return

            const nodeIdsToDelete = new Set(nodesToDelete.map((node) => node.id))

            // Filter out deleted nodes
            const remainingNodes = flowState.nodes.filter((node) => !nodeIdsToDelete.has(node.id))

            // Filter out edges connected to deleted nodes
            const remainingEdges = flowState.edges.filter(
                (edge) => !nodeIdsToDelete.has(edge.source) && !nodeIdsToDelete.has(edge.target)
            )

            // Update flow state
            const newFlowState: FlowState = {
                nodes: remainingNodes,
                edges: remainingEdges,
            }

            updateFlowState(newFlowState)

            // Close details panel if a selected node was deleted
            if (nodesToDelete.some((node) => node.selected)) {
                setDetailsPanelOpen(false)
            }
        },
        [readonly, flowState, updateFlowState]
    )

    const onEdgesDelete = useCallback(
        (edgesToDelete: Edge[]) => {
            if (readonly) return

            const edgeIdsToDelete = new Set(edgesToDelete.map((edge) => edge.id))
            const remainingEdges = flowState.edges.filter((edge) => !edgeIdsToDelete.has(edge.id))

            // Update flow state
            updateStepsFromFlow(undefined, remainingEdges)
        },
        [readonly, flowState.edges, updateStepsFromFlow]
    )

    // Drag and drop handlers
    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }, [])

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault()

            if (readonly) return

            const data = event.dataTransfer.getData('application/reactflow')
            if (!data) return

            const nodeData = JSON.parse(data)
            const position = screenToFlowPosition({
                x: event.clientX - 75,
                y: event.clientY - 50,
            })

            if (nodeData.type === 'condition') {
                // Add condition node
                const newId = generateId('condition')
                const newCondition: EnhancedConditionNode = {
                    id: newId,
                    type: 'conditionNode',
                    data: {
                        conditionId: newId,
                        description: 'When the user is happy!',
                    },
                    position,
                }

                const newFlowState: FlowState = {
                    nodes: [...flowState.nodes, newCondition],
                    edges: flowState.edges,
                }

                updateFlowState(newFlowState)
            } else if (nodeData.type === 'step' && nodeData.stepType) {
                // Create step node directly with the dropped position
                if (readonly) return

                const newId = generateId('step')
                const newStep: OnboardingStep<TContext> = {
                    id: newId,
                    type: nodeData.stepType,
                    payload: getDefaultPayload(nodeData.stepType),
                } as OnboardingStep<TContext>

                // Create enhanced step node with the drop position
                const newStepNode: EnhancedStepNode = {
                    id: String(newId),
                    type: 'stepNode',
                    data: {
                        stepId: newId,
                        stepType: nodeData.stepType,
                        label: getStepLabel(newStep),
                        description: getStepDescription(newStep),
                        isSkippable: Boolean(newStep.isSkippable),
                        hasCondition: typeof newStep.condition === 'function',
                        payload: newStep.payload,
                        condition: newStep.condition,
                        metadata: {},
                        nextStep: newStep.nextStep,
                        previousStep: newStep.previousStep,
                        skipToStep: newStep.skipToStep,
                    },
                    position: position, // Use the dropped position directly
                }

                const newFlowState: FlowState = {
                    nodes: [...flowState.nodes, newStepNode],
                    edges: flowState.edges,
                }

                updateFlowState(newFlowState)
            }
        },
        [readonly, screenToFlowPosition, flowState, updateFlowState, addStep]
    )

    const layoutFlow = useCallback(
        (direction: 'TB' | 'LR' = 'TB') => {
            const layoutedElements = layoutNodes<
                EnhancedStepNode | EndNodeType | EnhancedConditionNode,
                ConditionalFlowEdge
            >(flowState.nodes, flowState.edges, direction)

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
                const code = exportFlowAsCode(flowState, {
                    format: 'typescript',
                    includeTypes: typeScriptExportOptions.includeTypes,
                    includeComments: typeScriptExportOptions.includeComments,
                    variableName: typeScriptExportOptions.variableName,
                })

                const filename = 'onboarding-steps.ts'
                onExport?.(code, format, filename)

                // Also trigger file download
                downloadFile(code, filename, 'text/typescript')
            }
        },
        [steps, exportOptions, typeScriptExportOptions, flowState, onExport]
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

    const clearFlow = useCallback(() => {
        if (readonly) return

        if (confirm('Are you sure you want to clear the entire flow?')) {
            const emptyFlowState = stepsToFlowState([])
            updateFlowState(emptyFlowState)
            setDetailsPanelOpen(false)
        }
    }, [readonly, updateFlowState])

    return (
        <div id="flow-visualizer" className={`flow-visualizer ${className}`}>
            {/* Updated Toolbar */}
            <FlowToolbar
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
                <NodePalette />

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    isValidConnection={isValidConnection}
                    onNodeClick={onNodeClick}
                    onNodesDelete={onNodesDelete}
                    onEdgesDelete={onEdgesDelete}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    selectNodesOnDrag={false}
                    connectionLineType={ConnectionLineType.Bezier}
                    defaultEdgeOptions={{
                        markerEnd: { type: MarkerType.ArrowClosed },
                        type: 'conditional',
                    }}
                    fitView
                    deleteKeyCode={['Delete', 'Backspace']}
                    multiSelectionKeyCode="Shift"
                    panOnScroll
                    selectionOnDrag
                    panOnDrag={[1, 2]}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background />
                    <Controls />
                    <MiniMap
                        nodeColor={(node) => getStepTypeColor((node as StepNodeType).data.stepType || 'endNode')}
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
                            // Find the corresponding node and select it
                            const targetNode = nodes.find(
                                (node) => node.type === 'stepNode' && node.data.stepId === step.id
                            )
                            if (targetNode) {
                                // Update the node selection
                                const updatedNodes = nodes.map((node) => ({
                                    ...node,
                                    selected: node.id === targetNode.id,
                                }))
                                setNodes(updatedNodes)
                                setDetailsPanelOpen(true)
                            }
                        }}
                        onStepAdd={addStep}
                        onStepDelete={deleteStep}
                        onClose={() => setSidebarOpen(false)}
                        readonly={readonly}
                    />
                )}

                {/* Details Panel */}
                {detailsPanelOpen && selectedStepNode && (
                    <StepDetailsPanel
                        node={selectedStepNode}
                        onNodeUpdate={updateNode}
                        onClose={() => setDetailsPanelOpen(false)}
                        readonly={readonly}
                    />
                )}

                {/* Condition Details Panel */}
                {detailsPanelOpen && selectedConditionNode && (
                    <ConditionDetailsPanel
                        conditionNode={selectedConditionNode}
                        onUpdate={updateConditionNode}
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
                    }
                    e.target.value = ''
                }}
            />
        </div>
    )
}
