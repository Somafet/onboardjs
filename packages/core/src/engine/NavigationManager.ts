// src/engine/services/NavigationManager.ts

import { Logger } from '../services/Logger'
import { OnboardingContext, OnboardingStep, ChecklistStepPayload } from '../types'
import { findStepById, evaluateStepId } from '../utils/step-utils'
import { ChecklistManager } from './ChecklistManager'
import { ErrorHandler } from './ErrorHandler'
import { EventManager } from './EventManager'
import { PersistenceManager } from './PersistenceManager'
import { StateManager } from './StateManager'
import { BeforeStepChangeEvent } from './types'

export class NavigationManager<TContext extends OnboardingContext> {
    constructor(
        private steps: OnboardingStep<TContext>[],
        private eventManager: EventManager<TContext>,
        private stateManager: StateManager<TContext>,
        private checklistManager: ChecklistManager<TContext>,
        private persistenceManager: PersistenceManager<TContext>,
        private errorHandler: ErrorHandler<TContext>,
        private logger: Logger
    ) {}

    async navigateToStep(
        requestedTargetStepId: string | number | null | undefined,
        direction: 'next' | 'previous' | 'skip' | 'goto' | 'initial' = 'goto',
        currentStep: OnboardingStep<TContext> | null,
        context: TContext, // Context is passed by reference, allowing direct modification
        history: string[],
        onStepChangeCallback?: (
            newStep: OnboardingStep<TContext> | null,
            oldStep: OnboardingStep<TContext> | null,
            context: TContext
        ) => void,
        onFlowComplete?: (context: TContext) => Promise<void> | void
    ): Promise<OnboardingStep<TContext> | null> {
        let isCancelled = false
        let finalTargetStepId = requestedTargetStepId
        let redirected = false

        // Handle beforeStepChange event
        if (this.eventManager.getListenerCount('beforeStepChange') > 0) {
            const event: BeforeStepChangeEvent<TContext> = {
                currentStep,
                targetStepId: requestedTargetStepId,
                direction,
                cancel: () => {
                    isCancelled = true
                },
                redirect: (newTargetId) => {
                    if (!isCancelled) {
                        finalTargetStepId = newTargetId
                        redirected = true
                        this.logger.debug(
                            `[NavigationManager] Navigation redirected to ${newTargetId} by beforeStepChange listener.`
                        )
                    }
                },
            }

            try {
                await this.eventManager.notifyListenersSequential('beforeStepChange', event)
                if (isCancelled) {
                    this.logger.debug('[NavigationManager] Navigation cancelled by beforeStepChange listener.')
                    this.stateManager.setLoading(false)
                    return currentStep
                }
            } catch (error) {
                this.errorHandler.handleError(error, 'beforeStepChange listener', context)
                return currentStep
            }
        }

        this.stateManager.setLoading(true)
        this.stateManager.setError(null)

        let candidateStep: OnboardingStep<TContext> | undefined | null = findStepById(this.steps, finalTargetStepId)

        // This loop now correctly handles skipping by using our robust helper methods.
        while (candidateStep && candidateStep.condition && !candidateStep.condition(context)) {
            this.logger.debug(`[NavigationManager] Skipping conditional step: ${candidateStep.id}`)
            if (direction === 'previous') {
                // When skipping backwards, we must find the previous valid candidate
                // relative to the *current candidate*, not the original currentStep.
                // We pass an empty history to force it to use explicit `previousStep` or array order.
                candidateStep = this._findPreviousStepCandidate(
                    candidateStep,
                    context,
                    [] // Provide empty history here for the internal traversal logic
                )
            } else {
                // When skipping forwards, find the next valid candidate.
                candidateStep = this._findNextStepCandidate(candidateStep, context)
            }
        }

        const oldStep = currentStep
        const newCurrentStep = candidateStep ?? null

        // Emit navigation events based on direction
        if (currentStep && newCurrentStep && currentStep.id !== newCurrentStep.id) {
            switch (direction) {
                case 'previous':
                    this.eventManager.notifyListeners('navigationBack', {
                        fromStep: currentStep,
                        toStep: newCurrentStep,
                        context,
                    })
                    break
                case 'next':
                    this.eventManager.notifyListeners('navigationForward', {
                        fromStep: currentStep,
                        toStep: newCurrentStep,
                        context,
                    })
                    break
                case 'goto':
                    this.eventManager.notifyListeners('navigationJump', {
                        fromStep: currentStep,
                        toStep: newCurrentStep,
                        context,
                    })
                    break
            }
        }

        if (newCurrentStep) {
            const startTime = Date.now()

            // NEW: Directly record step start time in the context
            // We rely on ConfigurationBuilder ensuring _internal and stepStartTimes exist
            // Use String(id) for map keys for consistency, as step IDs can be numbers
            context.flowData._internal!.stepStartTimes![String(newCurrentStep.id)] = startTime
            this.logger.debug(`[NavigationManager] Recorded step start time for '${newCurrentStep.id}': ${startTime}`)

            // Initialize checklist data on activation
            if (newCurrentStep.type === 'CHECKLIST') {
                this.checklistManager.getChecklistItemsState(
                    newCurrentStep as OnboardingStep<TContext> & {
                        type: 'CHECKLIST'
                    },
                    context
                )
            }

            // Update history
            if (direction !== 'previous' && oldStep && oldStep.id !== newCurrentStep.id) {
                // Only push to history if it's not already the last entry
                if (history[history.length - 1] !== String(oldStep.id)) {
                    history.push(String(oldStep.id))
                }
            }

            // Execute step activation logic
            try {
                if (newCurrentStep.onStepActive) {
                    await newCurrentStep.onStepActive(context)
                }
                this.eventManager.notifyListeners('stepActive', {
                    step: newCurrentStep,
                    context,
                    startTime, // Still pass startTime in the event for consumers (e.g., AnalyticsManager)
                })
            } catch (error) {
                this.errorHandler.handleError(error, `onStepActive for ${newCurrentStep.id}`, context)
            }
        } else {
            // Flow is completed
            this.stateManager.setCompleted(true)
            const finalContext = context // Capture context at completion point

            // Calculate flow duration here, before onFlowComplete or persistence
            const flowStartedAt = finalContext.flowData._internal?.startedAt
            const flowDuration = flowStartedAt && flowStartedAt > 0 ? Date.now() - flowStartedAt : 0

            if (
                onFlowComplete &&
                direction !== 'initial' &&
                (!oldStep || !evaluateStepId(oldStep.nextStep, finalContext))
            ) {
                try {
                    await onFlowComplete(finalContext)
                } catch (error) {
                    const processedError = error instanceof Error ? error : new Error(String(error))
                    this.stateManager.setError(processedError)
                    this.errorHandler.handleError(error, 'onFlowComplete', context)
                }
            }

            this.eventManager.notifyListeners('flowCompleted', {
                context: finalContext,
                duration: Math.round(flowDuration), // Pass duration to event
            })
            await this.persistenceManager.persistDataIfNeeded(
                context,
                null, // Current step is null when flow completes
                this.stateManager.isHydrating
            )
        }

        // Execute step change callback
        if (onStepChangeCallback) {
            try {
                onStepChangeCallback(newCurrentStep, oldStep, context)
            } catch (error) {
                this.errorHandler.handleError(error, 'onStepChangeCallback', context)
            }
        }

        this.eventManager.notifyListeners('stepChange', {
            oldStep,
            newStep: newCurrentStep,
            context,
        })

        this.stateManager.setLoading(false)
        return newCurrentStep
    }

    async next(
        currentStep: OnboardingStep<TContext> | null,
        stepSpecificData: any,
        context: TContext,
        history: string[],
        onStepChangeCallback?: (
            newStep: OnboardingStep<TContext> | null,
            oldStep: OnboardingStep<TContext> | null,
            context: TContext
        ) => void,
        onFlowComplete?: (context: TContext) => Promise<void> | void
    ): Promise<OnboardingStep<TContext> | null> {
        if (!currentStep || this.stateManager.isLoading) {
            return currentStep
        }

        // Handle checklist completion check
        if (currentStep.type === 'CHECKLIST') {
            if (
                !this.checklistManager.isChecklistStepComplete(
                    currentStep as OnboardingStep<TContext> & {
                        type: 'CHECKLIST'
                    },
                    context
                )
            ) {
                const error = new Error('Checklist criteria not met.')
                this.logger.warn(
                    `[NavigationManager] Cannot proceed from checklist step '${currentStep.id}': Not all completion criteria met.`
                )
                this.stateManager.setError(error)
                this.eventManager.notifyListeners('error', { error, context })
                return currentStep
            }

            // Include checklist data in stepSpecificData
            const checklistPayload = currentStep.payload as ChecklistStepPayload
            stepSpecificData = {
                ...stepSpecificData,
                [checklistPayload.dataKey]: context.flowData[checklistPayload.dataKey] || [],
            }
        }

        this.stateManager.setLoading(true)
        this.stateManager.setError(null)

        try {
            // Update context with step-specific data
            if (stepSpecificData && Object.keys(stepSpecificData).length > 0) {
                const newFlowData = {
                    ...context.flowData,
                    ...stepSpecificData,
                }
                // Only update if actual changes, to prevent unnecessary contextUpdate events/persists
                if (JSON.stringify(context.flowData) !== JSON.stringify(newFlowData)) {
                    context.flowData = newFlowData
                }
            }

            // Execute step completion logic
            if (currentStep.onStepComplete) {
                await currentStep.onStepComplete(stepSpecificData || {}, context)
            }

            this.eventManager.notifyListeners('stepCompleted', {
                step: currentStep,
                stepData: stepSpecificData || {},
                context,
            })

            // Mark step as completed
            const currentStepId = currentStep.id
            // Ensure _internal exists. ConfigurationBuilder should handle initial setup,
            // but this makes it robust against direct context manipulation or old contexts.
            if (!context.flowData._internal) {
                context.flowData._internal = {
                    completedSteps: {},
                    startedAt: Date.now(),
                    stepStartTimes: {},
                }
            }
            context.flowData._internal.completedSteps = {
                ...(context.flowData._internal.completedSteps || {}),
                [currentStepId]: Date.now(),
            }

            // Determine next step
            // Use the new, robust helper to determine the next step.
            const nextStepCandidate = this._findNextStepCandidate(currentStep, context)
            const finalNextStepId = nextStepCandidate ? nextStepCandidate.id : null

            const newCurrentStep = await this.navigateToStep(
                finalNextStepId,
                'next',
                currentStep,
                context,
                history,
                onStepChangeCallback,
                onFlowComplete
            )

            await this.persistenceManager.persistDataIfNeeded(
                context,
                newCurrentStep?.id || null,
                this.stateManager.isHydrating
            )

            return newCurrentStep
        } catch (error) {
            this.errorHandler.handleError(error, `next() for step ${currentStep.id}`, context)
            this.stateManager.setLoading(false)
            return currentStep
        }
    }

    async previous(
        currentStep: OnboardingStep<TContext> | null,
        context: TContext,
        history: string[],
        onStepChangeCallback?: (
            newStep: OnboardingStep<TContext> | null,
            oldStep: OnboardingStep<TContext> | null,
            context: TContext
        ) => void,
        onFlowComplete?: (context: TContext) => Promise<void> | void
    ): Promise<OnboardingStep<TContext> | null> {
        if (!currentStep || this.stateManager.isLoading) {
            return currentStep
        }

        // Determine the previous step candidate
        const candidate = this._findPreviousStepCandidate(currentStep, context, history)
        const prevStepId = candidate ? candidate.id : null

        // We still need to pop from history if history was the source of the previous step ID
        // AND currentStep.previousStep was undefined.
        // If currentStep.previousStep *was* defined, we don't touch history because we followed the explicit path.
        if (
            evaluateStepId(currentStep.previousStep, context) === undefined && // Meaning `previousStep` wasn't explicitly set
            history.length > 0 &&
            history[history.length - 1] === prevStepId // Check if the candidate we found was indeed from history
        ) {
            history.pop()
        }

        if (prevStepId) {
            return this.navigateToStep(
                prevStepId,
                'previous',
                currentStep,
                context,
                history,
                onStepChangeCallback,
                onFlowComplete
            )
        }

        return currentStep // No previous step to go to
    }

    async skip(
        currentStep: OnboardingStep<TContext> | null,
        context: TContext,
        history: string[],
        onStepChangeCallback?: (
            newStep: OnboardingStep<TContext> | null,
            oldStep: OnboardingStep<TContext> | null,
            context: TContext
        ) => void,
        onFlowComplete?: (context: TContext) => Promise<void> | void
    ): Promise<OnboardingStep<TContext> | null> {
        if (!currentStep || !currentStep.isSkippable || this.stateManager.isLoading) {
            this.logger.debug(
                `[NavigationManager] skip(): Cannot skip from step '${currentStep?.id}'. Not skippable or engine loading.`
            )
            return currentStep
        }

        const skipReason = currentStep.skipToStep ? 'explicit_skip_target' : 'default_skip'
        this.eventManager.notifyListeners('stepSkipped', {
            step: currentStep,
            context,
            skipReason,
        })

        let finalSkipTargetId: string | number | null | undefined

        // Determine target step based on priority: skipToStep > nextStep > next in array
        let evaluatedSkipTarget = evaluateStepId(currentStep.skipToStep, context)
        if (evaluatedSkipTarget === undefined) {
            evaluatedSkipTarget = evaluateStepId(currentStep.nextStep, context)
        }

        if (evaluatedSkipTarget === undefined) {
            // Fallback to next step in the configuration array
            const currentIndex = this.steps.findIndex((s) => s.id === currentStep.id)
            if (currentIndex !== -1 && currentIndex < this.steps.length - 1) {
                // Find the first valid subsequent step in array order
                let nextInArrayCandidate: OnboardingStep<TContext> | undefined = undefined
                for (let i = currentIndex + 1; i < this.steps.length; i++) {
                    const step = this.steps[i]
                    if (!step.condition || step.condition(context)) {
                        nextInArrayCandidate = step
                        break
                    }
                }
                finalSkipTargetId = nextInArrayCandidate?.id
                if (nextInArrayCandidate) {
                    this.logger.debug(
                        `[NavigationManager] skip(): No explicit skip/next target. Skipping to next valid step in array: '${finalSkipTargetId}'`
                    )
                } else {
                    this.logger.debug(
                        `[NavigationManager] skip(): No explicit skip/next target and no subsequent valid step in array. Flow will complete.`
                    )
                }
            } else {
                finalSkipTargetId = null // No next step, so flow completes
                this.logger.debug(
                    `[NavigationManager] skip(): No explicit skip/next target, no next in array. Flow will complete on skip.`
                )
            }
        } else {
            finalSkipTargetId = evaluatedSkipTarget
        }

        return await this.navigateToStep(
            finalSkipTargetId,
            'skip',
            currentStep,
            context,
            history,
            onStepChangeCallback,
            onFlowComplete
        )
    }

    async goToStep(
        stepId: string,
        stepSpecificData: unknown,
        currentStep: OnboardingStep<TContext> | null,
        context: TContext,
        history: string[],
        onStepChangeCallback?: (
            newStep: OnboardingStep<TContext> | null,
            oldStep: OnboardingStep<TContext> | null,
            context: TContext
        ) => void,
        onFlowComplete?: (context: TContext) => Promise<void> | void
    ): Promise<OnboardingStep<TContext> | null> {
        if (this.stateManager.isLoading) {
            this.logger.debug(`[NavigationManager] goToStep(): Ignoring - engine is loading.`)
            return currentStep
        }

        if (stepSpecificData) {
            // Ensure flowData exists, even if ConfigurationBuilder covers it,
            // this makes it more robust against external context manipulation.
            if (!context.flowData) {
                context.flowData = {}
            }
            context.flowData = {
                ...context.flowData,
                ...stepSpecificData,
            }
            this.logger.debug(`[NavigationManager] goToStep(): Context flowData updated with step-specific data.`)
        }

        return await this.navigateToStep(
            stepId,
            'goto',
            currentStep,
            context,
            history,
            onStepChangeCallback,
            onFlowComplete
        )
    }

    private _findNextStepCandidate(
        currentStep: OnboardingStep<TContext>,
        context: TContext
    ): OnboardingStep<TContext> | undefined | null {
        // Priority 1: Explicit `nextStep` property.
        const explicitNextStepId = evaluateStepId(currentStep.nextStep, context)

        if (explicitNextStepId !== undefined) {
            if (explicitNextStepId === null) {
                // Flow is explicitly ended.
                return null
            }
            return findStepById(this.steps, explicitNextStepId) || undefined
        }

        // Priority 2: Array order (if nextStep is undefined).
        const currentIndex = this.steps.findIndex((s) => s.id === currentStep.id)
        if (currentIndex === -1) {
            return undefined
        }

        // Iterate through the rest of the array to find the first valid step.
        for (let i = currentIndex + 1; i < this.steps.length; i++) {
            const candidateStep = this.steps[i]
            if (!candidateStep.condition || candidateStep.condition(context)) {
                return candidateStep // Found the next valid step.
            }
        }

        return undefined // No valid next step found.
    }

    private _findPreviousStepCandidate(
        currentStep: OnboardingStep<TContext>,
        context: TContext,
        history: string[] // Pass history explicitly here for proper logic
    ): OnboardingStep<TContext> | undefined {
        // Priority 1: Explicit `previousStep` property.
        let targetId = evaluateStepId(currentStep.previousStep, context)

        if (targetId !== undefined) {
            return findStepById(this.steps, targetId) || undefined
        }

        // Priority 2: History (if previousStep is undefined).
        if (history.length > 0) {
            targetId = history[history.length - 1] // Use the last item in history
            return findStepById(this.steps, targetId) || undefined
        }

        // Priority 3: Array order (if previousStep and history are undefined/empty).
        const currentIndex = this.steps.findIndex((s) => s.id === currentStep.id)
        if (currentIndex > 0) {
            // Iterate backwards in the array to find the first valid step.
            for (let i = currentIndex - 1; i >= 0; i--) {
                const candidateStep = this.steps[i]
                if (!candidateStep.condition || candidateStep.condition(context)) {
                    return candidateStep // Found the previous valid step.
                }
            }
        }
        return undefined // No valid previous step found.
    }
}
