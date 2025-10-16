// src/analytics/aha-tracker/aha-tracker.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AhaTracker, aha } from './index'
import { AnalyticsManager } from '../analytics-manager'
import { AnalyticsProvider } from '../types'

describe('AhaTracker', () => {
    let tracker: AhaTracker

    beforeEach(() => {
        AhaTracker.resetInstance()
        tracker = AhaTracker.getInstance({
            debug: false,
            session_start_time: Date.now() - 5000, // 5 seconds ago
            user_signup_time: Date.now() - 10000, // 10 seconds ago
        })
    })

    afterEach(() => {
        AhaTracker.resetInstance()
    })

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = AhaTracker.getInstance()
            const instance2 = AhaTracker.getInstance()
            expect(instance1).toBe(instance2)
        })

        it('should reset instance', () => {
            const instance1 = AhaTracker.getInstance()
            AhaTracker.resetInstance()
            const instance2 = AhaTracker.getInstance()
            expect(instance1).not.toBe(instance2)
        })
    })

    describe('Basic Tracking', () => {
        it('should track a basic aha moment', async () => {
            const result = await tracker.track({
                aha_type: 'value_demonstration',
                user_id: 'user_123',
                context: {
                    feature_name: 'video_viewer',
                },
            })

            expect(result).toBeDefined()
            expect(result?.event_name).toBe('onboarding_aha_moment')
            expect(result?.aha_type).toBe('value_demonstration')
            expect(result?.user_id).toBe('user_123')
            expect(result?.context.feature_name).toBe('video_viewer')
        })

        it('should auto-generate session ID', async () => {
            const result = await tracker.track({
                aha_type: 'workflow_completion',
                user_id: 'user_456',
            })

            expect(result?.session_id).toBeDefined()
            expect(result?.session_id).toMatch(/^session_/)
        })

        it('should set default journey stage to activation', async () => {
            const result = await tracker.track({
                aha_type: 'feature_activation',
                user_id: 'user_789',
            })

            expect(result?.journey_stage).toBe('activation')
        })

        it('should respect custom journey stage', async () => {
            const result = await tracker.track({
                aha_type: 'engagement_threshold',
                journey_stage: 'retention',
                user_id: 'user_101',
            })

            expect(result?.journey_stage).toBe('retention')
        })

        it('should include timestamp and timezone', async () => {
            const result = await tracker.track({
                aha_type: 'setup_completion',
                user_id: 'user_102',
            })

            expect(result?.timestamp).toBeDefined()
            expect(result?.client_timestamp).toBeDefined()
            expect(result?.timezone).toBeDefined()
            expect(new Date(result!.timestamp).getTime()).toBeGreaterThan(0)
        })
    })

    describe('Metrics Calculation', () => {
        it('should calculate time_to_aha_seconds', async () => {
            const result = await tracker.track({
                aha_type: 'value_demonstration',
                user_id: 'user_200',
            })

            expect(result?.metrics.time_to_aha_seconds).toBeGreaterThanOrEqual(5)
            expect(result?.metrics.time_to_aha_seconds).toBeLessThanOrEqual(10)
        })

        it('should calculate time_since_signup_seconds', async () => {
            const result = await tracker.track({
                aha_type: 'workflow_completion',
                user_id: 'user_201',
            })

            expect(result?.metrics.time_since_signup_seconds).toBeGreaterThanOrEqual(10)
            expect(result?.metrics.time_since_signup_seconds).toBeLessThanOrEqual(15)
        })

        it('should accept custom metrics', async () => {
            const result = await tracker.track({
                aha_type: 'feature_activation',
                user_id: 'user_202',
                metrics: {
                    actions_before_aha: 15,
                    steps_completed: 5,
                    engagement_score: 85,
                    completion_rate: 0.71,
                },
            })

            expect(result?.metrics.actions_before_aha).toBe(15)
            expect(result?.metrics.steps_completed).toBe(5)
            expect(result?.metrics.engagement_score).toBe(85)
            expect(result?.metrics.completion_rate).toBe(0.71)
        })
    })

    describe('Context Building', () => {
        it('should track first aha correctly', async () => {
            const result = await tracker.track({
                aha_type: 'value_demonstration',
                user_id: 'user_300',
            })

            expect(result?.context.first_aha).toBe(true)
            expect(result?.context.previous_aha_events).toBe(0)
        })

        it('should track subsequent aha events', async () => {
            await tracker.track({
                aha_type: 'feature_activation',
                user_id: 'user_301',
            })

            const result = await tracker.track({
                aha_type: 'value_demonstration',
                user_id: 'user_301',
            })

            expect(result?.context.first_aha).toBe(false)
            expect(result?.context.previous_aha_events).toBe(1)
        })

        it('should accept custom context', async () => {
            const result = await tracker.track({
                aha_type: 'workflow_completion',
                user_id: 'user_302',
                context: {
                    feature_name: 'video_generation',
                    feature_category: 'ai_tools',
                    product_area: 'studio',
                    user_role: 'creator',
                    plan_type: 'pro',
                    is_trial: true,
                    custom_field: 'custom_value',
                },
            })

            expect(result?.context.feature_name).toBe('video_generation')
            expect(result?.context.feature_category).toBe('ai_tools')
            expect(result?.context.product_area).toBe('studio')
            expect(result?.context.user_role).toBe('creator')
            expect(result?.context.plan_type).toBe('pro')
            expect(result?.context.is_trial).toBe(true)
            expect(result?.context.custom_field).toBe('custom_value')
        })
    })

    describe('Deduplication', () => {
        it('should respect max_events_per_user', async () => {
            AhaTracker.resetInstance()
            tracker = AhaTracker.getInstance({ max_events_per_user: 2 })

            const result1 = await tracker.track({
                aha_type: 'feature_activation',
                user_id: 'user_400',
            })
            const result2 = await tracker.track({
                aha_type: 'value_demonstration',
                user_id: 'user_400',
            })
            const result3 = await tracker.track({
                aha_type: 'workflow_completion',
                user_id: 'user_400',
            })

            expect(result1).not.toBeNull()
            expect(result2).not.toBeNull()
            expect(result3).toBeNull() // Should be blocked
        })

        it('should respect cooldown period', async () => {
            AhaTracker.resetInstance()
            tracker = AhaTracker.getInstance({ cooldown_seconds: 5 })

            const result1 = await tracker.track({
                aha_type: 'feature_activation',
                user_id: 'user_401',
            })

            const result2 = await tracker.track({
                aha_type: 'value_demonstration',
                user_id: 'user_401',
            })

            expect(result1).not.toBeNull()
            expect(result2).toBeNull() // Should be blocked by cooldown
        })

        it('should track for different users independently', async () => {
            AhaTracker.resetInstance()
            tracker = AhaTracker.getInstance({ max_events_per_user: 1 })

            const result1 = await tracker.track({
                aha_type: 'feature_activation',
                user_id: 'user_402',
            })

            const result2 = await tracker.track({
                aha_type: 'feature_activation',
                user_id: 'user_403',
            })

            expect(result1).not.toBeNull()
            expect(result2).not.toBeNull()
        })
    })

    describe('Analytics Integration', () => {
        it('should send events to AnalyticsManager', async () => {
            const analyticsManager = new AnalyticsManager({ enabled: true })
            const trackEventSpy = vi.spyOn(analyticsManager, 'trackEvent')

            tracker.initialize(analyticsManager)

            await tracker.track({
                aha_type: 'value_demonstration',
                user_id: 'user_500',
            })

            expect(trackEventSpy).toHaveBeenCalledWith('onboarding_aha_moment', expect.any(Object))
        })

        it('should send events to custom providers', async () => {
            const mockProvider: AnalyticsProvider = {
                name: 'MockProvider',
                trackEvent: vi.fn(),
            }

            tracker.addProvider(mockProvider)

            await tracker.track({
                aha_type: 'workflow_completion',
                user_id: 'user_501',
            })

            expect(mockProvider.trackEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'onboarding_aha_moment',
                })
            )
        })
    })

    describe('User Statistics', () => {
        it('should return user aha statistics', async () => {
            await tracker.track({
                aha_type: 'feature_activation',
                user_id: 'user_600',
            })

            await tracker.track({
                aha_type: 'value_demonstration',
                user_id: 'user_600',
            })

            const stats = tracker.getUserAhaStats('user_600')
            expect(stats.total_aha_events).toBe(2)
            expect(stats.last_aha_time).toBeGreaterThan(0)
            expect(stats.can_track_aha).toBe(true)
        })

        it('should clear user data', async () => {
            await tracker.track({
                aha_type: 'feature_activation',
                user_id: 'user_601',
            })

            tracker.clearUserData('user_601')

            const stats = tracker.getUserAhaStats('user_601')
            expect(stats.total_aha_events).toBe(0)
            expect(stats.last_aha_time).toBeNull()
        })
    })

    describe('Convenience Function', () => {
        it('should work with aha() shorthand', async () => {
            const result = await aha({
                aha_type: 'value_demonstration',
                user_id: 'user_700',
                context: {
                    feature_name: 'video_viewer',
                },
            })

            expect(result).toBeDefined()
            expect(result?.event_name).toBe('onboarding_aha_moment')
        })
    })

    describe('Experiments', () => {
        it('should track experiment data', async () => {
            const result = await tracker.track({
                aha_type: 'workflow_completion',
                user_id: 'user_800',
                experiments: [
                    {
                        experiment_id: 'exp_001',
                        experiment_name: 'Onboarding Flow Test',
                        variant_id: 'variant_a',
                        variant_name: 'Short Flow',
                    },
                ],
            })

            expect(result?.experiments).toHaveLength(1)
            expect(result?.experiments?.[0].experiment_id).toBe('exp_001')
            expect(result?.experiments?.[0].variant_name).toBe('Short Flow')
        })
    })

    describe('Anonymous Users', () => {
        it('should track anonymous users', async () => {
            const result = await tracker.track({
                aha_type: 'feature_activation',
                anonymous_id: 'anon_123',
                context: {
                    feature_name: 'video_preview',
                },
            })

            expect(result?.anonymous_id).toBe('anon_123')
            expect(result?.user_id).toBeUndefined()
        })
    })
})
