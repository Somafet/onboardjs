import { Node, Edge } from '@xyflow/react'
import dagre from 'dagre'

/**
 * Layout nodes using dagre algorithm
 * @param nodes Array of nodes to layout
 * @param edges Array of edges to consider for layout
 * @param direction Layout direction (TB = top-bottom, LR = left-right)
 * @returns Object containing layouted nodes and unchanged edges
 */
export function layoutNodes<TNode extends Node, TEdge extends Edge>(
    nodes: TNode[],
    edges: TEdge[],
    direction: 'TB' | 'LR' = 'TB'
): { nodes: TNode[]; edges: TEdge[] } {
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))
    dagreGraph.setGraph({ rankdir: direction })

    // Add nodes to dagre graph
    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 250, height: 120 })
    })

    // Add edges to dagre graph
    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    // Apply dagre layout to nodes
    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id)
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - 125, // Adjust for node width
                y: nodeWithPosition.y - 60, // Adjust for node height
            },
        }
    })

    return {
        nodes: layoutedNodes,
        edges,
    }
}
