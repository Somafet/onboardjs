import { describe, it, expect, beforeEach, afterEach, vi, MockInstance } from 'vitest'
import { AnalyticsManager } from './analytics-manager'
import { AnalyticsConfig, AnalyticsProvider, AnalyticsEvent } from './types'
import { Logger } from '../services/Logger'
import { OnboardingContext, OnboardingStep, OnboardingStepType } from '../types'

// Mock context for testing
interface TestContext extends OnboardingContext {
    testData?: string
}

// Mock analytics provider for testing
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

// Helper to create mock step
const createMockStep = (id: string | number, type: OnboardingStepType = 'INFORMATION'): OnboardingStep<TestContext> => {
    const baseStep = {
        id,
        payload: {
            title: `Step ${id}`,
            validation: id === 'validation-step',
            required: id === 'required-step',
        },
        condition: id === 'conditional-step' ? () => true : undefined,
    }

    if (id === 'skippable-step') {
        return {
            ...baseStep,
            type,
            isSkippable: true,
            skipToStep: 'next-step',
        } as OnboardingStep<TestContext>
    }

    return {
        ...baseStep,
        type,
        isSkippable: false,
    } as OnboardingStep<TestContext>
}

// Helper to create mock context
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

describe('AnalyticsManager', () => {
    let analyticsManager: AnalyticsManager<TestContext>
    let mockProvider: MockAnalyticsProvider
    let mockLogger: Logger
    let consoleErrorSpy: MockInstance
    let consoleLogSpy: MockInstance

    // Mock global objects
    const mockWindow = {
        location: { href: 'https://example.com/onboarding' },
        innerWidth: 1920,
        innerHeight: 1080,
    }

    const mockNavigator = {
        userAgent: 'Mozilla/5.0 (Test Browser)',
        language: 'en-US',
        platform: 'Test Platform',
    }

    const mockScreen = {
        width: 1920,
        height: 1080,
    }

    const mockPerformance = {
        memory: {
            usedJSHeapSize: 1024000,
        },
    }

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-08-14T12:00:00Z'))

        // Mock global objects
        Object.defineProperty(global, 'window', {
            value: mockWindow,
            writable: true,
        })
        Object.defineProperty(global, 'navigator', {
            value: mockNavigator,
            writable: true,
        })
        Object.defineProperty(global, 'screen', {
            value: mockScreen,
            writable: true,
        })
        Object.defineProperty(global, 'performance', {
            value: mockPerformance,
            writable: true,
        })

        mockProvider = new MockAnalyticsProvider()
        mockLogger = new Logger({ debugMode: true, prefix: 'TEST' })

        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const config: AnalyticsConfig = {
            enabled: true,
            providers: [mockProvider],
            userId: 'test-user-123',
            flowId: 'test-flow',
            samplingRate: 1.0,
            debug: true,
            enableProgressMilestones: false, // Disable to avoid extra events in tests
            enablePerformanceTracking: true,
            enableChurnDetection: true,
            milestonePercentages: [25, 50, 75, 100],
            performanceThresholds: {
                slowStepMs: 3000,
                slowRenderMs: 2000,
            },
        }

        analyticsManager = new AnalyticsManager(config, mockLogger)
    })

    afterEach(() => {
        mockProvider.reset()
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    describe('Constructor', () => {
        it('should initialize with default config when no config provided', () => {
            const manager = new AnalyticsManager()
            expect(manager.providerCount).toBe(0)
        })

        it('should register providers from config', () => {
            expect(analyticsManager.providerCount).toBe(1)
        })

        it('should generate session ID if not provided', () => {
            const manager = new AnalyticsManager()
            expect(manager['sessionId']).toMatch(/^session_/)
        })

        it('should use provided session ID', () => {
            const config: AnalyticsConfig = { sessionId: 'custom-session-123' }
            const manager = new AnalyticsManager(config)
            expect(manager['sessionId']).toBe('custom-session-123')
        })

        it('should initialize with default thresholds', () => {
            const manager = new AnalyticsManager()
            expect(manager['config'].enableProgressMilestones).toBe(true)
            expect(manager['config'].enablePerformanceTracking).toBe(true)
            expect(manager['config'].enableChurnDetection).toBe(true)
        })
    })

    describe('Provider Management', () => {
        it('should register additional providers', () => {
            const newProvider = new MockAnalyticsProvider()
            newProvider.name = 'second-provider'

            analyticsManager.registerProvider(newProvider)
            expect(analyticsManager.providerCount).toBe(2)
        })

        it('should get correct provider count', () => {
            expect(analyticsManager.providerCount).toBe(1)

            analyticsManager.registerProvider(new MockAnalyticsProvider())
            expect(analyticsManager.providerCount).toBe(2)
        })
    })

    describe('Basic Event Tracking', () => {
        it('should track basic events with correct structure', () => {
            analyticsManager.trackEvent('test_event', { customProp: 'value' })

            expect(mockProvider.events).toHaveLength(1)
            const event = mockProvider.events[0]

            expect(event.type).toBe('test_event')
            expect(event.timestamp).toBe(Date.now())
            expect(event.sessionId).toMatch(/^session_/)
            expect(event.userId).toBe('test-user-123')
            expect(event.flowId).toBe('test-flow')
            expect(event.properties.customProp).toBe('value')
            expect(event.properties.pageUrl).toBe('https://example.com/onboarding')
        })

        it('should enrich events with session data', () => {
            analyticsManager.trackEvent('test_event')

            const event = mockProvider.events[0]
            expect(event.properties.sessionData).toEqual({
                userAgent: 'Mozilla/5.0 (Test Browser)',
                screenResolution: '1920x1080',
                viewportSize: '1920x1080',
                timezone: expect.any(String),
                language: 'en-US',
                platform: 'Test Platform',
            })
        })

        it('should enrich events with performance data when enabled', () => {
            analyticsManager.trackEvent('test_event')

            const event = mockProvider.events[0]
            expect(event.properties.performanceMetrics).toEqual({
                memoryUsage: 1024000,
                connectionType: undefined,
                renderTimeHistory: [],
            })
        })

        it('should not track events when disabled', () => {
            analyticsManager['config'].enabled = false
            analyticsManager.trackEvent('test_event')

            expect(mockProvider.events).toHaveLength(0)
        })

        it('should not track events when no providers', () => {
            const manager = new AnalyticsManager({ enabled: true })
            manager.trackEvent('test_event')

            expect(mockProvider.events).toHaveLength(0)
        })

        it('should handle provider errors gracefully', () => {
            mockProvider.shouldThrowError = true
            analyticsManager.trackEvent('test_event')

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'TEST [ERROR]',
                '[AnalyticsManager] Error in analytics provider "mock-provider":',
                expect.any(Error)
            )
        })

        it('should respect sampling rate', () => {
            analyticsManager['config'].samplingRate = 0.0 // Never sample
            analyticsManager.trackEvent('test_event')

            expect(mockProvider.events).toHaveLength(0)
        })
    })

    describe('Step Tracking', () => {
        const mockStep = createMockStep('step1', 'INFORMATION')
        const mockContext = createMockContext()

        describe('trackStepViewed', () => {
            it('should track step viewed with detailed information', () => {
                mockProvider.reset() // Clear any previous events
                analyticsManager.trackStepViewed(mockStep, mockContext)

                expect(mockProvider.events).toHaveLength(1)
                const event = mockProvider.events[0]

                expect(event.type).toBe('step_viewed')
                expect(event.properties).toMatchObject({
                    stepId: 'step1',
                    stepType: 'INFORMATION',
                    stepIndex: 0,
                    isFirstStep: true,
                    isLastStep: false,
                    flowProgressPercentage: expect.any(Number),
                    hasCondition: false,
                    isSkippable: false,
                    hasValidation: false,
                    payloadKeys: ['title', 'validation', 'required'],
                    payloadSize: expect.any(Number),
                })
            })

            it('should record step start time', () => {
                analyticsManager.trackStepViewed(mockStep, mockContext)

                expect(analyticsManager['stepStartTimes'].has('step1')).toBe(true)
                expect(analyticsManager['stepStartTimes'].get('step1')).toBe(Date.now())
            })

            it('should check progress milestones', () => {
                // Enable progress milestones for this specific test
                analyticsManager['config'].enableProgressMilestones = true
                const spy = vi.spyOn(analyticsManager as any, 'checkProgressMilestones')
                analyticsManager.trackStepViewed(mockStep, mockContext)

                expect(spy).toHaveBeenCalledWith(mockContext)
            })

            it('should detect step properties correctly', () => {
                mockProvider.reset()
                const validationStep = createMockStep('validation-step')
                const skippableStep = createMockStep('skippable-step')

                analyticsManager.trackStepViewed(validationStep, mockContext)
                expect(mockProvider.events[0].properties.hasValidation).toBe(true)

                mockProvider.reset() // Clear events before second test
                analyticsManager.trackStepViewed(skippableStep, mockContext)
                expect(mockProvider.events[0].properties.isSkippable).toBe(true)
            })
        })

        describe('trackStepCompleted', () => {
            beforeEach(() => {
                // Set up step start time
                analyticsManager['stepStartTimes'].set('step1', Date.now() - 5000)
            })

            it('should track step completion with duration', () => {
                mockProvider.reset()
                // Set a step start time that won't trigger slow step tracking (under 3000ms)
                analyticsManager['stepStartTimes'].set('step1', Date.now() - 1000) // 1 second ago

                const stepData = { answer: 'test answer', completionMethod: 'button_click' }
                analyticsManager.trackStepCompleted(mockStep, mockContext, 3000, stepData)

                expect(mockProvider.events).toHaveLength(1)
                const event = mockProvider.events[0]

                expect(event.type).toBe('step_completed')
                expect(event.properties).toMatchObject({
                    stepId: 'step1',
                    stepType: 'INFORMATION',
                    duration: 1000, // Uses actual time from start (1 second)
                    stepData: { answer: 'test answer', completionMethod: 'button_click' },
                    flowProgressPercentage: expect.any(Number),
                    completionMethod: 'button_click',
                    timeOnStep: 1000,
                    stepIndex: 0,
                })
            })

            it('should track slow steps when enabled', () => {
                const slowStepSpy = vi.spyOn(analyticsManager as any, 'trackSlowStep')
                analyticsManager['stepStartTimes'].set('step1', Date.now() - 4000) // 4 seconds

                analyticsManager.trackStepCompleted(mockStep, mockContext, 4000)

                expect(slowStepSpy).toHaveBeenCalledWith(mockStep, mockContext, 4000)
            })

            it('should clean up step start time', () => {
                analyticsManager.trackStepCompleted(mockStep, mockContext, 1000)

                expect(analyticsManager['stepStartTimes'].has('step1')).toBe(false)
            })

            it('should sanitize step data', () => {
                const sensitiveData = {
                    answer: 'safe data',
                    password: 'secret123',
                    apiKey: 'key123',
                }

                analyticsManager.trackStepCompleted(mockStep, mockContext, 1000, sensitiveData)

                const event = mockProvider.events[0]
                expect(event.properties.stepData).toEqual({
                    answer: 'safe data',
                    password: '[REDACTED]',
                    apiKey: '[REDACTED]',
                })
            })
        })
    })

    describe('Flow Tracking', () => {
        const mockContext = createMockContext()

        describe('trackFlowStarted', () => {
            it('should track flow start with fresh method', () => {
                analyticsManager.trackFlowStarted(mockContext, 'fresh')

                const event = mockProvider.events[0]
                expect(event.type).toBe('flow_started')
                expect(event.properties).toMatchObject({
                    startMethod: 'fresh',
                    isResumed: false,
                    totalSteps: expect.any(Number),
                    flowStartTime: Date.now(),
                    initialFlowDataSize: expect.any(Number),
                })
            })

            it('should track flow start with resumed method', () => {
                analyticsManager.trackFlowStarted(mockContext, 'resumed')

                const event = mockProvider.events[0]
                expect(event.properties.startMethod).toBe('resumed')
                expect(event.properties.isResumed).toBe(true)
            })

            it('should include browser information', () => {
                analyticsManager.trackFlowStarted(mockContext)

                const event = mockProvider.events[0]
                expect(event.properties.userAgent).toBe('Mozilla/5.0 (Test Browser)')
                expect(event.properties.screenResolution).toBe('1920x1080')
                expect(event.properties.viewportSize).toBe('1920x1080')
            })
        })

        describe('trackFlowCompleted', () => {
            it('should track flow completion with metrics', () => {
                const duration = analyticsManager['getFlowCompletionTime'](mockContext)
                analyticsManager.trackFlowCompleted(mockContext)

                const event = mockProvider.events[0]
                expect(event.type).toBe('flow_completed')
                expect(event.properties).toMatchObject({
                    duration: duration, // Use actual calculated duration
                    totalSteps: 2, // Based on completed steps
                    completedSteps: 2,
                    skippedSteps: 0,
                    completionRate: 100,
                    finalFlowDataSize: expect.any(Number),
                })
            })

            it('should clean up tracking data', () => {
                analyticsManager['progressMilestones'].add(25)
                analyticsManager['stepStartTimes'].set('step1', Date.now())

                analyticsManager.trackFlowCompleted(mockContext)

                expect(analyticsManager['progressMilestones'].size).toBe(0)
                expect(analyticsManager['stepStartTimes'].size).toBe(0)
            })
        })

        describe('trackFlowPaused', () => {
            it('should track flow pause with reason', () => {
                analyticsManager.trackFlowPaused(mockContext, 'user_action')

                const event = mockProvider.events[0]
                expect(event.type).toBe('flow_paused')
                expect(event.properties.reason).toBe('user_action')
            })
        })

        describe('trackFlowAbandoned', () => {
            it('should track flow abandonment with metrics', () => {
                const timeInFlow = analyticsManager['getFlowCompletionTime'](mockContext)
                analyticsManager.trackFlowAbandoned(mockContext, 'timeout')

                const event = mockProvider.events[0]
                expect(event.type).toBe('flow_abandoned')
                expect(event.properties).toMatchObject({
                    abandonmentReason: 'timeout',
                    flowProgressPercentage: expect.any(Number),
                    timeInFlow: timeInFlow, // Use actual calculated time
                    completedSteps: 2,
                    totalSteps: 2,
                })
            })
        })
    })

    describe('Navigation Tracking', () => {
        const fromStep = createMockStep('step1')
        const toStep = createMockStep('step2')
        const mockContext = createMockContext()

        describe('trackNavigationBack', () => {
            it('should track backward navigation', () => {
                analyticsManager.trackNavigationBack(fromStep, toStep, mockContext)

                const event = mockProvider.events[0]
                expect(event.type).toBe('navigation_back')
                expect(event.properties).toMatchObject({
                    fromStepId: 'step1',
                    toStepId: 'step2',
                    fromStepType: 'INFORMATION',
                    toStepType: 'INFORMATION',
                    fromStepIndex: 0,
                    toStepIndex: 0,
                    navigationDistance: 0,
                })
            })
        })

        describe('trackNavigationJump', () => {
            it('should track jump navigation with distance', () => {
                analyticsManager.trackNavigationJump(fromStep, toStep, mockContext)

                const event = mockProvider.events[0]
                expect(event.type).toBe('navigation_jump')
                expect(event.properties).toMatchObject({
                    fromStepId: 'step1',
                    toStepId: 'step2',
                    navigationDistance: 0,
                    isForwardJump: false,
                })
            })
        })
    })

    describe('Interaction Tracking', () => {
        const mockStep = createMockStep('step1')
        const mockContext = createMockContext()

        describe('trackUserIdle', () => {
            it('should track user idle state', () => {
                analyticsManager.trackUserIdle(mockStep, mockContext, 30000)

                expect(analyticsManager['userActivityState'].isIdle).toBe(true)
                expect(analyticsManager['userActivityState'].awayDuration).toBe(30000)

                const event = mockProvider.events[0]
                expect(event.type).toBe('user_idle')
                expect(event.properties.idleDuration).toBe(30000)
            })
        })

        describe('trackUserReturned', () => {
            it('should track user return from idle', () => {
                analyticsManager.trackUserReturned(mockStep, mockContext, 45000)

                expect(analyticsManager['userActivityState'].isIdle).toBe(false)
                expect(analyticsManager['userActivityState'].lastActivityTime).toBe(Date.now())

                const event = mockProvider.events[0]
                expect(event.type).toBe('user_returned')
                expect(event.properties.awayDuration).toBe(45000)
            })
        })

        describe('trackDataChanged', () => {
            it('should track data changes', () => {
                const oldData = { field1: 'old' }
                const newData = { field1: 'new', field2: 'added' }

                analyticsManager.trackDataChanged(mockContext, ['field1', 'field2'], oldData, newData)

                const event = mockProvider.events[0]
                expect(event.type).toBe('data_changed')
                expect(event.properties).toMatchObject({
                    changedFields: ['field1', 'field2'],
                    changedFieldCount: 2,
                    dataSizeBefore: expect.any(Number),
                    dataSizeAfter: expect.any(Number),
                })
            })
        })
    })

    describe('Performance Tracking', () => {
        const mockStep = createMockStep('step1')
        const mockContext = createMockContext()

        describe('trackStepRenderTime', () => {
            it('should track render time', () => {
                analyticsManager.trackStepRenderTime(mockStep, mockContext, 1500)

                expect(analyticsManager['performanceMetrics'].stepRenderTimes.get('step1')).toBe(1500)

                const event = mockProvider.events[0]
                expect(event.type).toBe('step_render_time')
                expect(event.properties).toMatchObject({
                    stepId: 'step1',
                    renderTime: 1500,
                    isSlowRender: false, // Below 2000ms threshold
                })
            })

            it('should identify slow renders', () => {
                analyticsManager.trackStepRenderTime(mockStep, mockContext, 2500)

                const event = mockProvider.events[0]
                expect(event.properties.isSlowRender).toBe(true)
            })
        })

        describe('trackPersistenceSuccess', () => {
            it('should track successful persistence', () => {
                analyticsManager.trackPersistenceSuccess(mockContext, 150)

                const event = mockProvider.events[0]
                expect(event.type).toBe('persistence_success')
                expect(event.properties).toMatchObject({
                    persistenceTime: 150,
                    dataPersisted: expect.any(Number),
                })
            })
        })

        describe('trackPersistenceFailure', () => {
            it('should track persistence failures', () => {
                const error = new Error('Database connection failed')
                analyticsManager.trackPersistenceFailure(mockContext, error)

                const event = mockProvider.events[0]
                expect(event.type).toBe('persistence_failure')
                expect(event.properties).toMatchObject({
                    errorMessage: 'Database connection failed',
                    errorName: 'Error',
                })
            })
        })
    })

    describe('Error Tracking', () => {
        const mockContext = createMockContext()

        it('should track errors with context', () => {
            const error = new Error('Something went wrong')
            error.stack = 'Error: Something went wrong\n    at test.js:1:1'

            analyticsManager.trackErrorEncountered(error, mockContext, 'step1')

            const event = mockProvider.events[0]
            expect(event.type).toBe('error_encountered')
            expect(event.properties).toMatchObject({
                errorMessage: 'Something went wrong',
                errorStack: expect.stringContaining('Error: Something went wrong'),
                errorName: 'Error',
                currentStepId: 'step1',
            })
        })
    })

    describe('Progress Milestones', () => {
        const mockContext = createMockContext()

        it('should track progress milestones', () => {
            const timeToMilestone = analyticsManager['getFlowCompletionTime'](mockContext)
            analyticsManager.trackProgressMilestone(mockContext, 50)

            const event = mockProvider.events[0]
            expect(event.type).toBe('progress_milestone')
            expect(event.properties).toMatchObject({
                milestonePercentage: 50,
                actualProgress: expect.any(Number),
                stepsCompleted: 2,
                timeToMilestone: timeToMilestone, // Use actual calculated time
            })
        })

        it('should not track same milestone twice', () => {
            analyticsManager['progressMilestones'].add(25)

            // Mock the checkProgressMilestones method to simulate reaching 25%
            const context = createMockContext()
            vi.spyOn(analyticsManager as any, 'calculateFlowProgress').mockReturnValue(25)
            ;(analyticsManager as any).checkProgressMilestones(context)

            expect(mockProvider.events).toHaveLength(0) // Already tracked
        })
    })

    describe('Checklist Tracking', () => {
        const mockStep = createMockStep('checklist-step', 'CHECKLIST')
        const mockContext = createMockContext()

        describe('trackChecklistItemToggled', () => {
            it('should track checklist item toggles', () => {
                analyticsManager.trackChecklistItemToggled('item1', true, mockStep, mockContext)

                const event = mockProvider.events[0]
                expect(event.type).toBe('checklist_item_toggled')
                expect(event.properties).toMatchObject({
                    itemId: 'item1',
                    isCompleted: true,
                    stepId: 'checklist-step',
                    stepType: 'CHECKLIST',
                })
            })
        })

        describe('trackChecklistProgressChanged', () => {
            it('should track checklist progress', () => {
                const progress = { completed: 3, total: 5, percentage: 60, isComplete: false }
                analyticsManager.trackChecklistProgressChanged(mockStep, mockContext, progress)

                const event = mockProvider.events[0]
                expect(event.type).toBe('checklist_progress_changed')
                expect(event.properties).toMatchObject({
                    stepId: 'checklist-step',
                    completed: 3,
                    total: 5,
                    percentage: 60,
                    isComplete: false,
                })
            })
        })
    })

    describe('Configuration Management', () => {
        it('should set user ID', () => {
            analyticsManager.setUserId('new-user-456')
            expect(analyticsManager['config'].userId).toBe('new-user-456')
        })

        it('should set flow ID', () => {
            analyticsManager.setFlowId('new-flow-789')
            expect(analyticsManager['config'].flowId).toBe('new-flow-789')
            expect(analyticsManager['flowInfo'].flowId).toBe('new-flow-789')
        })

        it('should set flow info', () => {
            const flowInfo = {
                flowId: 'flow-123',
                flowName: 'Test Flow',
                flowVersion: '1.0.0',
                flowMetadata: { feature: 'test' },
                instanceId: 456,
            }

            analyticsManager.setFlowInfo(flowInfo)
            expect(analyticsManager['flowInfo']).toEqual(flowInfo)
            expect(analyticsManager['config'].flowId).toBe('flow-123')
        })
    })

    describe('Provider Management', () => {
        it('should flush all providers', async () => {
            await analyticsManager.flush()
            expect(mockProvider.flushCalled).toBe(true)
        })

        it('should handle flush errors gracefully', async () => {
            const errorProvider = new MockAnalyticsProvider()
            errorProvider.flush = vi.fn().mockRejectedValue(new Error('Flush failed'))
            analyticsManager.registerProvider(errorProvider)

            await analyticsManager.flush()

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'TEST [ERROR]',
                'Error flushing provider mock-provider:',
                expect.any(Error)
            )
        })
    })

    describe('Helper Methods', () => {
        const mockContext = createMockContext()

        describe('sanitizeContext', () => {
            it('should remove sensitive data from context', () => {
                const sensitiveContext = createMockContext({
                    currentUser: { id: '123', email: 'test@example.com' },
                    apiKeys: { secret: 'key123' },
                    tokens: { access: 'token456' },
                })

                const sanitized = (analyticsManager as any).sanitizeContext(sensitiveContext)

                expect(sanitized.currentUser).toBeUndefined()
                expect(sanitized.apiKeys).toBeUndefined()
                expect(sanitized.tokens).toBeUndefined()
                expect(sanitized.flowData).toBeDefined()
            })
        })

        describe('calculateFlowProgress', () => {
            it('should calculate progress percentage correctly', () => {
                vi.spyOn(analyticsManager as any, 'getTotalSteps').mockReturnValue(4)
                vi.spyOn(analyticsManager as any, 'getCompletedStepsCount').mockReturnValue(2)

                const progress = (analyticsManager as any).calculateFlowProgress(mockContext)
                expect(progress).toBe(50)
            })

            it('should handle zero total steps', () => {
                vi.spyOn(analyticsManager as any, 'getTotalSteps').mockReturnValue(0)

                const progress = (analyticsManager as any).calculateFlowProgress(mockContext)
                expect(progress).toBe(0)
            })
        })

        describe('calculateChurnRisk', () => {
            it('should calculate churn risk based on time and progress', () => {
                const step = createMockStep('step1')
                vi.spyOn(analyticsManager as any, 'calculateFlowProgress').mockReturnValue(25)

                const risk = (analyticsManager as any).calculateChurnRisk(step, mockContext, 120000) // 2 minutes
                expect(risk).toBeGreaterThan(0)
                expect(risk).toBeLessThanOrEqual(1)
            })
        })

        describe('getCompletionMethod', () => {
            it('should detect completion method from step data', () => {
                expect((analyticsManager as any).getCompletionMethod({ completionMethod: 'custom' })).toBe('custom')
                expect((analyticsManager as any).getCompletionMethod({ buttonClicked: true })).toBe('button_click')
                expect((analyticsManager as any).getCompletionMethod({ formSubmitted: true })).toBe('form_submit')
                expect((analyticsManager as any).getCompletionMethod({ keyPressed: 'Enter' })).toBe('keyboard')
                expect((analyticsManager as any).getCompletionMethod({})).toBe('unknown')
            })
        })

        describe('hasValidation', () => {
            it('should detect validation in step payload', () => {
                const stepWithValidation = createMockStep('test', 'INFORMATION')
                stepWithValidation.payload = { validation: true }

                expect((analyticsManager as any).hasValidation(stepWithValidation)).toBe(true)

                const stepWithoutValidation = createMockStep('test')
                expect((analyticsManager as any).hasValidation(stepWithoutValidation)).toBe(false)
            })
        })
    })

    describe('Edge Cases', () => {
        it('should handle missing browser APIs gracefully', () => {
            // Mock undefined globals instead of deleting
            const originalWindow = global.window
            const originalNavigator = global.navigator
            const originalScreen = global.screen
            const originalPerformance = global.performance

            // @ts-expect-error: Intentionally setting to undefined for testing
            global.window = undefined
            // @ts-expect-error: Intentionally setting to undefined for testing
            global.navigator = undefined
            // @ts-expect-error: Intentionally setting to undefined for testing
            global.screen = undefined
            // @ts-expect-error: Intentionally setting to undefined for testing
            global.performance = undefined

            const manager = new AnalyticsManager({ enabled: true })
            manager.trackEvent('test_event')

            // Should not throw errors
            expect(true).toBe(true)

            // Restore globals
            global.window = originalWindow
            global.navigator = originalNavigator
            global.screen = originalScreen
            global.performance = originalPerformance
        })

        it('should handle malformed step data', () => {
            const malformedStep = { id: 'test' } as OnboardingStep<TestContext>
            const context = createMockContext()

            expect(() => {
                analyticsManager.trackStepViewed(malformedStep, context)
            }).not.toThrow()
        })

        it('should handle circular references in sanitization', () => {
            const circular: any = { data: 'test' }
            circular.self = circular

            expect(() => {
                ;(analyticsManager as any).sanitizeStepData(circular)
            }).not.toThrow()
        })
    })
})
