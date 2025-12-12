import { Logger } from '../services/Logger'

/**
 * ProgressMilestoneTracker tracks milestone achievement and percentage tracking.
 * Manages progress percentage calculation and milestone detection.
 */
export class ProgressMilestoneTracker {
    private _progressMilestones: Set<number> = new Set()
    private _milestonePercentages: number[]
    private _logger: Logger

    constructor(milestonePercentages: number[] = [25, 50, 75, 100], logger?: Logger) {
        this._milestonePercentages = milestonePercentages
        this._logger = logger || new Logger({ prefix: 'ProgressMilestoneTracker' })
    }

    calculateFlowProgress(completedSteps: number, totalSteps: number): number {
        if (totalSteps <= 0) return 0
        return Math.round((completedSteps / totalSteps) * 100)
    }

    checkForNewMilestones(progress: number): number[] {
        const newMilestones: number[] = []

        for (const milestone of this._milestonePercentages) {
            if (progress >= milestone && !this._progressMilestones.has(milestone)) {
                this._progressMilestones.add(milestone)
                newMilestones.push(milestone)
                this._logger.debug(`Progress milestone reached: ${milestone}%`)
            }
        }

        return newMilestones
    }

    hasMilestoneBeenReached(milestone: number): boolean {
        return this._progressMilestones.has(milestone)
    }

    getReachedMilestones(): number[] {
        return Array.from(this._progressMilestones).sort((a, b) => a - b)
    }

    getMilestonePercentages(): ReadonlyArray<number> {
        return [...this._milestonePercentages]
    }

    reset(): void {
        this._progressMilestones.clear()
        this._logger.debug('Progress milestones reset')
    }

    setMilestonePercentages(percentages: number[]): void {
        this._milestonePercentages = percentages
        this._progressMilestones.clear()
        this._logger.debug(`Milestone percentages updated: ${percentages.join(', ')}%`)
    }
}
