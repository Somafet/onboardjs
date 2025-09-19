export const getStepTypeColor = (stepType: string) => {
    switch (stepType) {
        case 'INFORMATION':
            return '#3b82f6'
        case 'SINGLE_CHOICE':
            return '#10b981'
        case 'MULTIPLE_CHOICE':
            return '#8b5cf6'
        case 'CHECKLIST':
            return '#f59e0b'
        case 'CONFIRMATION':
            return '#ef4444'
        case 'CUSTOM_COMPONENT':
            return '#6b7280'
        case 'endNode':
            return '#f59e0b'
        default:
            return '#3b82f6'
    }
}
