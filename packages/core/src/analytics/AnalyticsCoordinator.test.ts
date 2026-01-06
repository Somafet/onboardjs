import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnalyticsCoordinator } from './AnalyticsCoordinator'
import { AnalyticsEvent, AnalyticsProvider } from './types'

describe('AnalyticsCoordinator - before_send Hook', () => {
    let coordinator: AnalyticsCoordinator
    let mockProvider: AnalyticsProvider
    let providerTrackEventSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
        providerTrackEventSpy = vi.fn()
        mockProvider = {
            name: 'mock-provider',
            trackEvent: providerTrackEventSpy,
        }
    })

    describe('Event filtering', () => {
        it('should drop events when before_send returns null', () => {
            const beforeSend = vi.fn(() => null)

            coordinator = new AnalyticsCoordinator({
                enabled: true,
                providers: [mockProvider],
                before_send: beforeSend,
            })

            coordinator.trackEvent('test_event', { value: 123 })

            expect(beforeSend).toHaveBeenCalledOnce()
            expect(providerTrackEventSpy).not.toHaveBeenCalled()
        })

        it('should pass events to providers when before_send returns the event', () => {
            const beforeSend = vi.fn((event) => event)

            coordinator = new AnalyticsCoordinator({
                enabled: true,
                providers: [mockProvider],
                before_send: beforeSend,
            })

            coordinator.trackEvent('test_event', { value: 123 })

            expect(beforeSend).toHaveBeenCalledOnce()
            expect(providerTrackEventSpy).toHaveBeenCalledOnce()

            const capturedEvent = providerTrackEventSpy.mock.calls[0][0] as AnalyticsEvent
            expect(capturedEvent.type).toBe('test_event')
        })

        it('should allow before_send to modify events', () => {
            const beforeSend = vi.fn((event: AnalyticsEvent) => ({
                ...event,
                properties: {
                    ...event.properties,
                    modified: true,
                },
            }))

            coordinator = new AnalyticsCoordinator({
                enabled: true,
                providers: [mockProvider],
                before_send: beforeSend,
            })

            coordinator.trackEvent('test_event', { value: 123 })

            expect(providerTrackEventSpy).toHaveBeenCalledOnce()

            const capturedEvent = providerTrackEventSpy.mock.calls[0][0] as AnalyticsEvent
            expect(capturedEvent.properties.modified).toBe(true)
            expect(capturedEvent.properties.value).toBe(123)
        })

        it('should filter multiple events independently', () => {
            const beforeSend = vi.fn((event: AnalyticsEvent) => {
                // Drop events with 'secret' in properties
                if (event.properties.secret) {
                    return null
                }
                return event
            })

            coordinator = new AnalyticsCoordinator({
                enabled: true,
                providers: [mockProvider],
                before_send: beforeSend,
            })

            coordinator.trackEvent('event_1', { value: 1 })
            coordinator.trackEvent('event_2', { secret: 'hidden' })
            coordinator.trackEvent('event_3', { value: 3 })

            expect(beforeSend).toHaveBeenCalledTimes(3)
            expect(providerTrackEventSpy).toHaveBeenCalledTimes(2)

            const capturedEvents = providerTrackEventSpy.mock.calls.map((call) => call[0] as AnalyticsEvent)
            expect(capturedEvents[0].type).toBe('event_1')
            expect(capturedEvents[1].type).toBe('event_3')
        })

        it('should continue with original event if before_send throws', () => {
            const beforeSend = vi.fn(() => {
                throw new Error('Hook error')
            })

            const loggerSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            coordinator = new AnalyticsCoordinator({
                enabled: true,
                providers: [mockProvider],
                before_send: beforeSend,
                debug: false,
            })

            coordinator.trackEvent('test_event', { value: 123 })

            expect(beforeSend).toHaveBeenCalledOnce()
            expect(providerTrackEventSpy).toHaveBeenCalledOnce()

            const capturedEvent = providerTrackEventSpy.mock.calls[0][0] as AnalyticsEvent
            expect(capturedEvent.type).toBe('test_event')
            expect(capturedEvent.properties.value).toBe(123)

            loggerSpy.mockRestore()
        })
    })

    describe('Batching compatibility', () => {
        it('should filter events before batching to multiple providers', () => {
            const beforeSend = vi.fn((event: AnalyticsEvent) => {
                if (event.properties.dropMe) {
                    return null
                }
                return event
            })

            const provider2Spy = vi.fn()
            const provider2: AnalyticsProvider = {
                name: 'provider-2',
                trackEvent: provider2Spy,
            }

            coordinator = new AnalyticsCoordinator({
                enabled: true,
                providers: [mockProvider, provider2],
                before_send: beforeSend,
            })

            coordinator.trackEvent('event_1', { value: 1 })
            coordinator.trackEvent('event_2', { dropMe: true })
            coordinator.trackEvent('event_3', { value: 3 })

            // All providers should receive the same filtered events
            expect(providerTrackEventSpy).toHaveBeenCalledTimes(2)
            expect(provider2Spy).toHaveBeenCalledTimes(2)

            // Both should have identical event types
            const provider1Events = providerTrackEventSpy.mock.calls.map((call) => (call[0] as AnalyticsEvent).type)
            const provider2Events = provider2Spy.mock.calls.map((call) => (call[0] as AnalyticsEvent).type)

            expect(provider1Events).toEqual(provider2Events)
            expect(provider1Events).toEqual(['event_1', 'event_3'])
        })

        it('should apply before_send before sampling check', () => {
            const beforeSend = vi.fn((event: AnalyticsEvent) => {
                // Mark critical events to always pass through sampling
                if (event.properties.critical) {
                    return {
                        ...event,
                        properties: {
                            ...event.properties,
                            bypassed_sampling: true,
                        },
                    }
                }
                return event
            })

            coordinator = new AnalyticsCoordinator({
                enabled: true,
                providers: [mockProvider],
                before_send: beforeSend,
                samplingRate: 1.0, // 100% sampling to ensure events reach provider
            })

            // Send multiple events - some marked as critical
            for (let i = 0; i < 10; i++) {
                coordinator.trackEvent('test_event', {
                    critical: i % 2 === 0, // Mark even-indexed events as critical
                    index: i,
                })
            }

            // before_send should be called for all 10 events
            expect(beforeSend).toHaveBeenCalledTimes(10)

            // Some events passed through to provider (with 100% sampling, all should pass)
            // All modified events should have the marker
            const sentEvents = providerTrackEventSpy.mock.calls.map((call) => call[0] as AnalyticsEvent)
            const eventsSentThroughModification = sentEvents.filter((e) => e.properties.bypassed_sampling === true)

            // We expect at least some events to have been modified (all of them with 100% sampling)
            expect(eventsSentThroughModification.length).toBeGreaterThan(0)
        })
    })

    describe('No before_send configured', () => {
        it('should track events normally when before_send is not configured', () => {
            coordinator = new AnalyticsCoordinator({
                enabled: true,
                providers: [mockProvider],
            })

            coordinator.trackEvent('test_event', { value: 123 })

            expect(providerTrackEventSpy).toHaveBeenCalledOnce()

            const capturedEvent = providerTrackEventSpy.mock.calls[0][0] as AnalyticsEvent
            expect(capturedEvent.type).toBe('test_event')
            expect(capturedEvent.properties.value).toBe(123)
        })
    })

    describe('Event enrichment with before_send', () => {
        it('should have access to session data in before_send', () => {
            const beforeSend = vi.fn((event: AnalyticsEvent) => {
                // Verify session enrichment was applied
                expect(event.sessionId).toBeDefined()
                expect(event.timestamp).toBeGreaterThan(0)
                return event
            })

            coordinator = new AnalyticsCoordinator({
                enabled: true,
                providers: [mockProvider],
                before_send: beforeSend,
            })

            coordinator.setUserId('user-123')
            coordinator.setFlowId('flow-123')
            coordinator.trackEvent('test_event', {})

            expect(beforeSend).toHaveBeenCalledOnce()
            const event = beforeSend.mock.calls[0][0] as AnalyticsEvent
            expect(event.userId).toBe('user-123')
            expect(event.flowId).toBe('flow-123')
        })

        it('should allow before_send to add global properties', () => {
            const beforeSend = vi.fn((event: AnalyticsEvent) => ({
                ...event,
                properties: {
                    ...event.properties,
                    environment: 'production',
                    appVersion: '1.0.0',
                },
            }))

            coordinator = new AnalyticsCoordinator({
                enabled: true,
                providers: [mockProvider],
                before_send: beforeSend,
            })

            coordinator.trackEvent('test_event', { original: 'data' })

            const capturedEvent = providerTrackEventSpy.mock.calls[0][0] as AnalyticsEvent
            expect(capturedEvent.properties.original).toBe('data')
            expect(capturedEvent.properties.environment).toBe('production')
            expect(capturedEvent.properties.appVersion).toBe('1.0.0')
        })
    })
})
