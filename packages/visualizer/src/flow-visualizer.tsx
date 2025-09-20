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
import { TypeScriptExportOptions } from './utils/typescript-exporter'
import { StepNode } from './nodes/step-node'
import { EndNode } from './nodes/end-node'
import { ConditionNode } from './nodes/condition-node'
import { ConditionalEdge, ConditionalFlowEdge } from './edges/conditional-edge'
import { FlowToolbar } from './components/flow-toolbar'
import { FlowSidebar } from './components/flow-sidebar'
import { NodePalette } from './components/node-palette'
import { StepDetailsPanel } from './components/step-details-panel'
import { ConditionDetailsPanel } from './components/condition-details-panel'
import { ConditionalFlowMode } from './components/conditional-flow-mode'

// Import from new modular structure
import { FlowState, EnhancedStepNode, EnhancedConditionNode, ExportFormat } from './types'
import { stepsToFlowState, exportFlowAsSteps, exportFlowAsCode } from './converters'
import { layoutNodes, generateId, getDefaultPayload, getStepLabel, getStepDescription } from './utils'

import './flow-visualizer.css'
import '../styles.css'
import { getStepTypeColor } from './utils/colors.utils'

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
    const [flowState, setFlowState] = useState<FlowState>(() => stepsToFlowState(initialSteps))

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

    // Derive steps from flow state for backwards compatibility
    const steps = useMemo(() => exportFlowAsSteps<TContext>(flowState), [flowState])

    const stepsById = useMemo(() => {
        return new Map(steps.map((step) => [step.id, step]))
    }, [steps])

    const fileInputRef = useRef<HTMLInputElement>(null)
    const isInitialMount = useRef(true)
    const lastInitialSteps = useRef(initialSteps)

    // Use flow state directly for nodes and edges
    const { nodes: flowNodes, edges: flowEdges } = flowState

    // Filter edges based on visibility settings
    const visibleEdges = useMemo(() => {
        return flowEdges.filter((edge) => {
            const edgeType = edge.data?.edgeType || 'next'
            return edgeVisibility[edgeType as keyof typeof edgeVisibility]
        })
    }, [flowEdges, edgeVisibility])

    // React Flow state - primary source of truth for UI
    const [nodes, setNodes, onNodesChangeBase] = useNodesState(flowNodes)
    const [edges, setEdges, onEdgesChangeBase] = useEdgesState(visibleEdges)

    const { fitView, getNodes, getEdges, screenToFlowPosition } = useReactFlow<
        EnhancedStepNode | EndNode | EnhancedConditionNode,
        ConditionalFlowEdge
    >()

    // Enhanced change handlers that sync back to flowState without causing resets
    const onNodesChange = useCallback(
        (changes: any[]) => {
            onNodesChangeBase(changes)

            // Sync back to flowState after React Flow processes the changes
            setTimeout(() => {
                const currentNodes = getNodes() as (EnhancedStepNode | EndNode | EnhancedConditionNode)[]
                const currentEdges = getEdges() as ConditionalFlowEdge[]

                setFlowState({
                    nodes: currentNodes,
                    edges: currentEdges,
                })
            }, 0)
        },
        [onNodesChangeBase, getNodes, getEdges]
    )

    const onEdgesChange = useCallback(
        (changes: any[]) => {
            onEdgesChangeBase(changes)

            // Sync back to flowState after React Flow processes the changes
            setTimeout(() => {
                const currentNodes = getNodes() as (EnhancedStepNode | EndNode | EnhancedConditionNode)[]
                const currentEdges = getEdges() as ConditionalFlowEdge[]

                setFlowState({
                    nodes: currentNodes,
                    edges: currentEdges,
                })
            }, 0)
        },
        [onEdgesChangeBase, getNodes, getEdges]
    )

    // Notify parent when steps change
    useEffect(() => {
        onStepsChange?.(steps)
    }, [steps, onStepsChange])

    const updateFlowState = useCallback(
        (newFlowState: FlowState) => {
            // Update React Flow state directly (primary source)
            setNodes(newFlowState.nodes)
            setEdges(newFlowState.edges)

            // Update our internal state for exports
            setFlowState(newFlowState)
        },
        [setNodes, setEdges]
    )

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

    const updateStepsFromFlow = useCallback(
        (newNodes?: (EnhancedStepNode | EndNode | EnhancedConditionNode)[], newEdges?: ConditionalFlowEdge[]) => {
            if (readonly) {
                return { updatedSteps: steps, updatedNodes: flowNodes, updatedEdges: flowEdges }
            }

            const currentNodes = newNodes ?? flowState.nodes
            const currentEdges = newEdges ?? flowState.edges

            const newFlowState: FlowState = {
                nodes: currentNodes,
                edges: currentEdges,
            }

            updateFlowState(newFlowState)

            return {
                updatedSteps: exportFlowAsSteps<TContext>(newFlowState),
                updatedNodes: currentNodes,
                updatedEdges: currentEdges,
            }
        },
        [readonly, flowState, updateFlowState]
    )

    const onConnect = useCallback(
        (params: Connection) => {
            console.log('onConnect', params)

            if (readonly) return

            // Determine edge type based on source handle
            let edgeType: 'next' | 'skip' | 'previous' | 'then' | 'else' = 'next'
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
            } else if (params.sourceHandle === 'then') {
                edgeType = 'then'
                label = 'Then'
            } else if (params.sourceHandle === 'else') {
                edgeType = 'else'
                label = 'Else'
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
            const filteredEdges = flowState.edges.filter(
                (e) => !(e.source === params.source && e.data?.edgeType === edgeType)
            )

            updateStepsFromFlow(undefined, [...filteredEdges, newEdge])
        },
        [readonly, flowState.edges, updateStepsFromFlow]
    )

    // Validate connections - ensure proper flow logic
    const isValidConnection = useCallback(
        (connection: ConditionalFlowEdge | Connection) => {
            // Don't allow self-connections
            if (connection.source === connection.target) {
                return false
            }

            // Allow connections from condition nodes (then/else handles) to any step node
            const sourceNode = flowState.nodes.find((n) => n.id === connection.source)
            const targetNode = flowState.nodes.find((n) => n.id === connection.target)

            if (!sourceNode || !targetNode) {
                return false
            }

            // Condition nodes can connect to step nodes or end nodes
            if (
                sourceNode.type === 'conditionNode' &&
                (connection.sourceHandle === 'then' || connection.sourceHandle === 'else')
            ) {
                return targetNode.type === 'stepNode' || targetNode.type === 'endNode'
            }

            // Step nodes can connect to other step nodes, end nodes, or condition nodes
            if (sourceNode.type === 'stepNode') {
                return (
                    targetNode.type === 'stepNode' ||
                    targetNode.type === 'endNode' ||
                    targetNode.type === 'conditionNode'
                )
            }

            // Don't allow connections from end nodes
            if (sourceNode.type === 'endNode') {
                return false
            }

            return true
        },
        [flowState.nodes]
    )

    // Get selected nodes from ReactFlow
    const selectedNodes = useMemo(() => {
        return nodes.filter((node) => node.selected)
    }, [nodes])

    // Get the currently selected step and condition nodes
    const selectedStepNode = selectedNodes.find((node): node is EnhancedStepNode => node.type === 'stepNode')
    const selectedConditionNode = selectedNodes.find(
        (node): node is EnhancedConditionNode => node.type === 'conditionNode'
    )

    // Derive the selected step for the details panel
    const selectedStep = useMemo(() => {
        if (!selectedStepNode) return null
        return steps.find((step) => step.id === selectedStepNode.data.stepId) || null
    }, [selectedStepNode, steps])

    const onNodeClick = useCallback((_: React.MouseEvent, node: EnhancedStepNode | EndNode | EnhancedConditionNode) => {
        if (node.type === 'stepNode') {
            setDetailsPanelOpen(true)
        } else if (node.type === 'conditionNode') {
            setDetailsPanelOpen(true)
        }
    }, [])

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

    // Step management functions
    const addStep = useCallback(
        (stepType: OnboardingStep<TContext>['type'] = 'INFORMATION') => {
            if (readonly) return

            const newId = generateId('step')
            const newStep: OnboardingStep<TContext> = {
                id: newId,
                type: stepType,
                payload: getDefaultPayload(stepType),
            } as OnboardingStep<TContext>

            // Create enhanced step node
            const newStepNode: EnhancedStepNode = {
                id: String(newId),
                type: 'stepNode',
                data: {
                    stepId: newId,
                    stepType: stepType,
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
                position: { x: 0, y: flowState.nodes.length * 150 },
            }

            const newFlowState: FlowState = {
                nodes: [...flowState.nodes, newStepNode],
                edges: flowState.edges,
            }

            updateFlowState(newFlowState)
        },
        [readonly, flowState, updateFlowState]
    )

    const updateStep = useCallback(
        (updatedStep: OnboardingStep<TContext>) => {
            if (readonly) return

            // Find and update the corresponding node
            const updatedNodes = flowState.nodes.map((node) => {
                if (node.type === 'stepNode') {
                    const stepNode = node as EnhancedStepNode
                    if (
                        stepNode.data.stepId === updatedStep.id ||
                        (selectedStepNode && stepNode.data.stepId === selectedStepNode.data.stepId)
                    ) {
                        return {
                            ...stepNode,
                            data: {
                                ...stepNode.data,
                                stepId: updatedStep.id,
                                stepType: updatedStep.type ?? 'INFORMATION',
                                label: getStepLabel(updatedStep),
                                description: getStepDescription(updatedStep),
                                isSkippable: Boolean(updatedStep.isSkippable),
                                hasCondition: typeof updatedStep.condition === 'function',
                                payload: updatedStep.payload,
                                condition: updatedStep.condition,
                                nextStep: updatedStep.nextStep,
                                previousStep: updatedStep.previousStep,
                                skipToStep: updatedStep.skipToStep,
                            },
                        }
                    }
                }
                return node
            })

            const newFlowState: FlowState = {
                nodes: updatedNodes,
                edges: flowState.edges,
            }

            updateFlowState(newFlowState)
        },
        [readonly, flowState, updateFlowState, selectedStepNode]
    )

    const deleteStep = useCallback(
        (stepId: string | number) => {
            if (readonly) return

            // Find the node to delete
            const nodeToDelete = flowState.nodes.find((node) => node.type === 'stepNode' && node.data.stepId === stepId)

            if (nodeToDelete) {
                // Filter out the node and its connected edges
                const remainingNodes = flowState.nodes.filter((node) => node.id !== nodeToDelete.id)
                const remainingEdges = flowState.edges.filter(
                    (edge) => edge.source !== nodeToDelete.id && edge.target !== nodeToDelete.id
                )

                const newFlowState: FlowState = {
                    nodes: remainingNodes,
                    edges: remainingEdges,
                }

                updateFlowState(newFlowState)

                // Close details panel if the deleted step was selected
                if (selectedStepNode && selectedStepNode.data.stepId === stepId) {
                    setDetailsPanelOpen(false)
                }
            }
        },
        [readonly, flowState, updateFlowState, selectedStepNode]
    )

    const updateConditionNode = useCallback(
        (updatedNode: EnhancedConditionNode) => {
            if (readonly) return

            // Update the corresponding enhanced condition node
            const updatedNodes = flowState.nodes.map((node) => {
                if (node.id === updatedNode.id && node.type === 'conditionNode') {
                    const enhancedNode = node as EnhancedConditionNode
                    return {
                        ...enhancedNode,
                        data: {
                            ...enhancedNode.data,
                            conditionId: updatedNode.data.conditionId,
                            description: updatedNode.data.description,
                            errors: updatedNode.data.errors,
                            condition: updatedNode.data.condition as any,
                        },
                        position: updatedNode.position,
                    }
                }
                return node
            })

            const newFlowState: FlowState = {
                nodes: updatedNodes,
                edges: flowState.edges,
            }

            updateFlowState(newFlowState)
        },
        [readonly, flowState, updateFlowState]
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

            try {
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
            } catch (error) {
                console.error('Error parsing drop data:', error)
            }
        },
        [readonly, screenToFlowPosition, flowState, updateFlowState, addStep]
    )

    const layoutFlow = useCallback(
        (direction: 'TB' | 'LR' = 'TB') => {
            const layoutedElements = layoutNodes<
                EnhancedStepNode | EndNode | EnhancedConditionNode,
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
        <div className={`flow-visualizer ${className}`}>
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
                {/* Conditional Flow Mode */}
                {conditionalModeOpen && (
                    <div className="absolute top-4 left-4 z-10 max-w-md">
                        <ConditionalFlowMode
                            steps={steps}
                            onStepsChange={(newSteps) => {
                                const newFlowState = stepsToFlowState(newSteps)
                                updateFlowState(newFlowState)
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
                    isValidConnection={isValidConnection}
                    onNodeClick={onNodeClick}
                    onNodesDelete={onNodesDelete}
                    onEdgesDelete={onEdgesDelete}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
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
                            // Find the corresponding node and select it
                            const targetNode = nodes.find(
                                (node) => node.type === 'stepNode' && (node as EnhancedStepNode).data.stepId === step.id
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
                {detailsPanelOpen && selectedStep && (
                    <StepDetailsPanel
                        step={selectedStep}
                        onStepUpdate={updateStep}
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

                {/* Conditional Flow Mode */}
                {conditionalModeOpen && (
                    <div className="absolute top-4 left-4 z-40">
                        <ConditionalFlowMode
                            steps={steps}
                            onStepsChange={(newSteps) => {
                                const newFlowState = stepsToFlowState(newSteps)
                                updateFlowState(newFlowState)
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
