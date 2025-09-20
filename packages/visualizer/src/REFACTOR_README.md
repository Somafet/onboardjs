# Node-First Architecture Refactor

This demonstrates the new node-first architecture for the OnboardJS Flow Visualizer.

## Key Benefits

### 1. **No Data Loss**

Conditional node connections are preserved across renders because we store the flow state directly instead of constantly converting between steps and visual representation.

### 2. **Single Source of Truth**

The `FlowState` interface maintains all visual and logical information:

```typescript
interface FlowState {
    nodes: (EnhancedStepNode | EndNode | EnhancedConditionNode)[]
    edges: ConditionalFlowEdge[]
}
```

### 3. **Enhanced Node Data**

Step nodes now store complete step information directly:

```typescript
interface EnhancedStepNodeData {
    // Visual properties
    stepId: string | number
    stepType: OnboardingStepType
    label: string
    description?: string

    // Step properties stored directly
    payload?: any
    condition?: Function | string
    metadata?: Record<string, any>

    // Navigation properties (for visual display only)
    nextStep?: string | number | null | Function
    previousStep?: string | number | Function
    skipToStep?: string | number | null | Function
}
```

### 4. **Export-Time Conversion**

Instead of constantly converting, we only convert when exporting:

```typescript
// Convert to steps only when needed
const steps = exportFlowAsSteps(flowState)

// Or generate code directly
const code = exportFlowAsCode(flowState, {
    format: 'typescript',
    includeTypes: true,
    variableName: 'myFlow',
})
```

## Migration Path

### Phase 1: Enhanced Components (Current)

- New `FlowVisualizerEnhanced` component uses FlowState
- Legacy `FlowVisualizer` remains for backward compatibility
- Both share the same utilities

### Phase 2: Gradual Adoption

- Teams can migrate to `FlowVisualizerEnhanced` incrementally
- Legacy conversion functions marked as deprecated but functional

### Phase 3: Full Migration

- Replace `FlowVisualizer` with enhanced version
- Remove legacy conversion functions
- Add new features that benefit from node-first approach

## Fixing the Conditional Node Issue

The original problem was:

1. Connect step → conditional node: `nextStep` becomes `"condition-yfthmb"`
2. Connect conditional node → step: Edge is lost on render

**Root Cause**: Constant conversion between steps and visual representation loses edges that don't map to the step model.

**Solution**: Store edges directly in FlowState, only export to steps when needed.

## Example Usage

```typescript
// Initialize from existing steps
const flowState = stepsToFlowState(existingSteps)

// User connects nodes visually
const newEdge = {
    source: 'step-1',
    target: 'condition-yfthmb',
    sourceHandle: 'next',
}

// Update flow state directly - no conversion needed
const newFlowState = {
    nodes: flowState.nodes,
    edges: [...flowState.edges, newEdge],
}

// Export only when needed
const finalSteps = exportFlowAsSteps(newFlowState)
```

This approach eliminates the impedance mismatch and provides a foundation for more complex visual flows.
