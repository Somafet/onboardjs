import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AnalyticsManager } from './analytics-manager'
import { AnalyticsConfig, AnalyticsProvider, AnalyticsEvent } from './types'
import { Logger } from '../services/Logger'
import { OnboardingContext, OnboardingStep, OnboardingStepType } from '../types'

interface TestContext extends OnboardingContext {
    testData?: string
}

class MockAnalyticsProvider implements AnalyticsProvider {
    name = 'mock-provider'
    events: AnalyticsEvent[] = []
    flushCalled = false
    shouldThrowError = false

    trackEvent(event: AnalyticsEvent): void {
        if (this.shouldThrowError) {
            throw new Error('Mock provider error')
        }
        this.events.push(event)
    }

    async flush(): Promise<void> {
        this.flushCalled = true
    }

    reset(): void {
        this.events = []
        this.flushCalled = false
        this.shouldThrowError = false
    }
}

const createMockStep = (id: string | number, type: OnboardingStepType = 'INFORMATION'): OnboardingStep<TestContext> => {
    const baseStep = {
        id,
        type,
        payload: {
            title: `Step ${id}`,
            validation: id === 'validation-step',
            required: id === 'required-step',
        },
        condition: id === 'conditional-step' ? () => true : undefined,
    } as any

    if (id === 'skippable-step') {
        return { ...baseStep, isSkippable: true, skipToStep: 'next-step' }
    }

    return { ...baseStep, isSkippable: false }
}

const createMockContext = (overrides: Partial<TestContext> = {}): TestContext => ({
    flowData: {
        _internal: {
            completedSteps: { step1: Date.now() - 5000, step2: Date.now() - 3000 },
            startedAt: Date.now() - 10000,
            stepStartTimes: { step1: Date.now() - 8000, step2: Date.now() - 6000 },
        },
        userData: { name: 'Test User' },
    },
    currentUser: { id: 'user123', email: 'test@example.com' },
    ...overrides,
})

describe('AnalyticsManager v2 (Refactored)', () => {
    let analyticsManager: AnalyticsManager<TestContext>
    let mockProvider: MockAnalyticsProvider
    let mockLogger: Logger

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-08-14T12:00:00Z'))

        mockProvider = new MockAnalyticsProvider()
        mockLogger = new Logger({ debugMode: true, prefix: 'TEST' })

        const config: AnalyticsConfig = {
            enabled: true,
            providers: [mockProvider],
            userId: 'test-user-123',
            flowId: 'test-flow',
            samplingRate: 1.0,
            debug: true,
            enableProgressMilestones: false,
            enablePerformanceTracking: true,
            enableChurnDetection: true,
        }

        analyticsManager = new AnalyticsManager(config, mockLogger)
    })

    afterEach(() => {
        mockProvider.reset()
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    describe('Constructor', () => {
        it('should initialize with config', () => {
            expect(analyticsManager.providerCount).toBe(1)
        })

        it('should create coordinator and delegate', () => {
            const manager = new AnalyticsManager()
            expect(manager.providerCount).toBe(0)
        })
    })

    describe('Provider Management', () => {
        it('should register providers via coordinator', () => {
            const newProvider = new MockAnalyticsProvider()
            newProvider.name = 'second-provider'

            analyticsManager.registerProvider(newProvider)
            expect(analyticsManager.providerCount).toBe(2)
        })
    })

    describe('Session Management', () => {
        it('should set user ID', () => {
            analyticsManager.setUserId('new-user')
            // Verify by checking if events include new user ID
            analyticsManager.trackEvent('test')
            expect(mockProvider.events[0].userId).toBe('new-user')
        })

        it('should set flow ID', () => {
            analyticsManager.setFlowId('new-flow')
            analyticsManager.trackEvent('test')
            expect(mockProvider.events[0].flowId).toBe('new-flow')
        })

        it('should set flow info', () => {
            const flowInfo = {
                flowId: 'flow-123',
                flowName: 'Test Flow',
                flowVersion: '1.0.0',
            }
            analyticsManager.setFlowInfo(flowInfo)
            analyticsManager.trackEvent('test')
            // Verify flow info was set
            expect(mockProvider.events).toHaveLength(1)
        })
    })

    describe('Step Tracking', () => {
        const mockStep = createMockStep('step1')
        const mockContext = createMockContext()

        it('should track step viewed', () => {
            // Disable progress milestones for this test to avoid extra events
            const manager = new AnalyticsManager(
                {
                    enabled: true,
                    providers: [mockProvider],
                    enableProgressMilestones: false,
                },
                mockLogger
            )
            manager.trackStepViewed(mockStep, mockContext)

            expect(mockProvider.events).toHaveLength(1)
            const event = mockProvider.events[0]
            expect(event.type).toBe('step_viewed')
            expect(event.properties.stepId).toBe('step1')
            expect(event.properties.stepType).toBe('INFORMATION')
        })

        it('should track step completed with duration', () => {
            analyticsManager.trackStepViewed(mockStep, mockContext)
            mockProvider.reset()

            analyticsManager.trackStepCompleted(mockStep, mockContext, 1500, { answer: 'test' })

            expect(mockProvider.events).toHaveLength(1)
            const event = mockProvider.events[0]
            expect(event.type).toBe('step_completed')
            expect(event.properties.stepId).toBe('step1')
            expect(event.properties.duration).toBeLessThanOrEqual(1500)
        })

        it('should track step skipped', () => {
            analyticsManager.trackStepSkipped(mockStep, mockContext, 'user_closed')

            const event = mockProvider.events[0]
            expect(event.type).toBe('step_skipped')
            expect(event.properties.skipReason).toBe('user_closed')
        })

        it('should track step retried', () => {
            analyticsManager.trackStepRetried(mockStep, mockContext, 2)

            const event = mockProvider.events[0]
            expect(event.type).toBe('step_retried')
            expect(event.properties.retryCount).toBe(2)
        })

        it('should track validation failure', () => {
            analyticsManager.trackStepValidationFailed(mockStep, mockContext, ['Email is required', 'Invalid format'])

            const event = mockProvider.events[0]
            expect(event.type).toBe('step_validation_failed')
            expect(event.properties.errorCount).toBe(2)
        })

        it('should track help requested', () => {
            analyticsManager.trackStepHelpRequested(mockStep, mockContext, 'tooltip')

            const event = mockProvider.events[0]
            expect(event.type).toBe('step_help_requested')
            expect(event.properties.helpType).toBe('tooltip')
        })

        it('should track step abandoned', () => {
            analyticsManager.trackStepAbandoned(mockStep, mockContext, 45000)

            const event = mockProvider.events[0]
            expect(event.type).toBe('step_abandoned')
            expect(event.properties.churnRiskScore).toBeGreaterThan(0)
            expect(event.properties.churnRiskScore).toBeLessThanOrEqual(1)
        })

        it('should track render time', () => {
            analyticsManager.trackStepRenderTime(mockStep, mockContext, 1200)

            const event = mockProvider.events[0]
            expect(event.type).toBe('step_render_time')
            expect(event.properties.renderTime).toBe(1200)
            expect(event.properties.isSlowRender).toBe(false)
        })

        it('should detect slow renders', () => {
            analyticsManager.trackStepRenderTime(mockStep, mockContext, 2500)

            const event = mockProvider.events[0]
            expect(event.properties.isSlowRender).toBe(true)
        })
    })

    describe('Flow Tracking', () => {
        const mockContext = createMockContext()

        it('should track flow started', () => {
            analyticsManager.trackFlowStarted(mockContext, 'fresh')

            const event = mockProvider.events[0]
            expect(event.type).toBe('flow_started')
            expect(event.properties.startMethod).toBe('fresh')
            expect(event.properties.isResumed).toBe(false)
        })

        it('should track flow started as resumed', () => {
            analyticsManager.trackFlowStarted(mockContext, 'resumed')

            const event = mockProvider.events[0]
            expect(event.properties.isResumed).toBe(true)
        })

        it('should track flow completed', () => {
            analyticsManager.trackFlowCompleted(mockContext)

            const event = mockProvider.events[0]
            expect(event.type).toBe('flow_completed')
            expect(event.properties).toHaveProperty('completionRate')
            expect(event.properties).toHaveProperty('completedSteps')
        })

        it('should track flow paused', () => {
            analyticsManager.trackFlowPaused(mockContext, 'user_action')

            const event = mockProvider.events[0]
            expect(event.type).toBe('flow_paused')
            expect(event.properties.reason).toBe('user_action')
        })

        it('should track flow resumed', () => {
            analyticsManager.trackFlowResumed(mockContext, 'saved_progress')

            const event = mockProvider.events[0]
            expect(event.type).toBe('flow_resumed')
            expect(event.properties.resumePoint).toBe('saved_progress')
        })

        it('should track flow abandoned', () => {
            analyticsManager.trackFlowAbandoned(mockContext, 'timeout')

            const event = mockProvider.events[0]
            expect(event.type).toBe('flow_abandoned')
            expect(event.properties.abandonmentReason).toBe('timeout')
        })

        it('should track flow reset', () => {
            analyticsManager.trackFlowReset(mockContext, 'user_requested')

            const event = mockProvider.events[0]
            expect(event.type).toBe('flow_reset')
            expect(event.properties.resetReason).toBe('user_requested')
        })
    })

    describe('Navigation Tracking', () => {
        const fromStep = createMockStep('step1')
        const toStep = createMockStep('step2')

        it('should track navigation back', () => {
            analyticsManager.trackNavigationBack(fromStep, toStep)

            const event = mockProvider.events[0]
            expect(event.type).toBe('navigation_back')
            expect(event.properties.fromStepId).toBe('step1')
            expect(event.properties.toStepId).toBe('step2')
        })

        it('should track navigation forward', () => {
            analyticsManager.trackNavigationForward(fromStep, toStep)

            const event = mockProvider.events[0]
            expect(event.type).toBe('navigation_forward')
            expect(event.properties.fromStepId).toBe('step1')
        })

        it('should track navigation jump', () => {
            analyticsManager.trackNavigationJump(fromStep, toStep)

            const event = mockProvider.events[0]
            expect(event.type).toBe('navigation_jump')
            expect(event.properties).toHaveProperty('navigationDistance')
        })
    })

    describe('User Activity Tracking', () => {
        const mockStep = createMockStep('step1')
        const mockContext = createMockContext()

        it('should track user idle', () => {
            analyticsManager.trackUserIdle(mockStep, mockContext, 30000)

            const event = mockProvider.events[0]
            expect(event.type).toBe('user_idle')
            expect(event.properties.idleDuration).toBe(30000)
        })

        it('should track user returned', () => {
            analyticsManager.trackUserReturned(mockStep, mockContext, 45000)

            const event = mockProvider.events[0]
            expect(event.type).toBe('user_returned')
            expect(event.properties.awayDuration).toBe(45000)
        })
    })

    describe('Data Tracking', () => {
        const mockContext = createMockContext()

        it('should track data changes', () => {
            analyticsManager.trackDataChanged(mockContext, ['field1', 'field2'], { old: 'data' }, { new: 'data' })

            const event = mockProvider.events[0]
            expect(event.type).toBe('data_changed')
            expect(event.properties.changedFieldCount).toBe(2)
        })

        it('should track persistence success', () => {
            analyticsManager.trackPersistenceSuccess(mockContext, 150)

            const event = mockProvider.events[0]
            expect(event.type).toBe('persistence_success')
            expect(event.properties.persistenceTime).toBe(150)
        })

        it('should track persistence failure', () => {
            const error = new Error('Database error')
            analyticsManager.trackPersistenceFailure(mockContext, error)

            const event = mockProvider.events[0]
            expect(event.type).toBe('persistence_failure')
            expect(event.properties.errorMessage).toBe('Database error')
        })
    })

    describe('Checklist Tracking', () => {
        const mockStep = createMockStep('checklist', 'CHECKLIST')

        it('should track checklist item toggle', () => {
            analyticsManager.trackChecklistItemToggled('item1', true, mockStep)

            const event = mockProvider.events[0]
            expect(event.type).toBe('checklist_item_toggled')
            expect(event.properties.itemId).toBe('item1')
            expect(event.properties.isCompleted).toBe(true)
        })

        it('should track checklist progress', () => {
            const progress = { completed: 3, total: 5, percentage: 60, isComplete: false }
            analyticsManager.trackChecklistProgressChanged(mockStep, progress)

            const event = mockProvider.events[0]
            expect(event.type).toBe('checklist_progress_changed')
            expect(event.properties.completed).toBe(3)
            expect(event.properties.percentage).toBe(60)
        })
    })

    describe('Error Tracking', () => {
        const mockContext = createMockContext()

        it('should track error encountered', () => {
            const error = new Error('Step validation failed')
            analyticsManager.trackErrorEncountered(error, mockContext, 'step1')

            const event = mockProvider.events[0]
            expect(event.type).toBe('error_encountered')
            expect(event.properties.errorMessage).toBe('Step validation failed')
            expect(event.properties.currentStepId).toBe('step1')
        })
    })

    describe('Progress Tracking', () => {
        const mockContext = createMockContext()

        it('should track progress milestone', () => {
            analyticsManager.trackProgressMilestone(mockContext, 50)

            const event = mockProvider.events[0]
            expect(event.type).toBe('progress_milestone')
            expect(event.properties.milestonePercentage).toBe(50)
            expect(event.properties).toHaveProperty('stepsCompleted')
            expect(event.properties).toHaveProperty('totalSteps')
        })

        it('should track slow step', () => {
            const mockStep = createMockStep('step1')
            analyticsManager.trackSlowStep(mockStep, mockContext, 4500)

            const event = mockProvider.events[0]
            expect(event.type).toBe('step_slow')
            expect(event.properties.duration).toBe(4500)
            expect(event.properties.threshold).toBe(3000)
        })
    })

    describe('Event Core', () => {
        it('should track basic events', () => {
            analyticsManager.trackEvent('custom_event', { customProp: 'value' })

            const event = mockProvider.events[0]
            expect(event.type).toBe('custom_event')
            expect(event.properties.customProp).toBe('value')
            expect(event).toHaveProperty('sessionId')
            expect(event).toHaveProperty('userId')
        })
    })

    describe('Provider Management', () => {
        it('should flush providers', async () => {
            await analyticsManager.flush()
            expect(mockProvider.flushCalled).toBe(true)
        })
    })
})
