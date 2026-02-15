// @onboardjs/react/src/adapters/react-router.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createReactRouterNavigator, type ReactRouterNavigateFunction, type ReactRouterLocation } from './react-router'

describe('createReactRouterNavigator', () => {
    let mockNavigate: ReactRouterNavigateFunction
    let mockLocation: ReactRouterLocation
    let windowAddEventListenerSpy: ReturnType<typeof vi.spyOn>
    let windowRemoveEventListenerSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        mockNavigate = vi.fn()
        mockLocation = {
            pathname: '/current-path',
            search: '',
            hash: '',
            state: null,
            key: 'default',
        }

        windowAddEventListenerSpy = vi.spyOn(window, 'addEventListener')
        windowRemoveEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('navigate', () => {
        it('should call navigate with the path', () => {
            const navigator = createReactRouterNavigator(mockNavigate, mockLocation)

            navigator.navigate('/new-path')

            expect(mockNavigate).toHaveBeenCalledWith('/new-path', { replace: undefined })
        })

        it('should pass replace option to navigate', () => {
            const navigator = createReactRouterNavigator(mockNavigate, mockLocation)

            navigator.navigate('/new-path', { replace: true })

            expect(mockNavigate).toHaveBeenCalledWith('/new-path', { replace: true })
        })

        it('should handle false replace option', () => {
            const navigator = createReactRouterNavigator(mockNavigate, mockLocation)

            navigator.navigate('/new-path', { replace: false })

            expect(mockNavigate).toHaveBeenCalledWith('/new-path', { replace: false })
        })
    })

    describe('getCurrentPath', () => {
        it('should return the location pathname', () => {
            const navigator = createReactRouterNavigator(mockNavigate, mockLocation)

            expect(navigator.getCurrentPath()).toBe('/current-path')
        })

        it('should return different paths based on location', () => {
            const location1: ReactRouterLocation = { ...mockLocation, pathname: '/path1' }
            const location2: ReactRouterLocation = { ...mockLocation, pathname: '/path2' }

            const navigator1 = createReactRouterNavigator(mockNavigate, location1)
            const navigator2 = createReactRouterNavigator(mockNavigate, location2)

            expect(navigator1.getCurrentPath()).toBe('/path1')
            expect(navigator2.getCurrentPath()).toBe('/path2')
        })
    })

    describe('onRouteChange', () => {
        it('should add a popstate event listener', () => {
            const navigator = createReactRouterNavigator(mockNavigate, mockLocation)
            const callback = vi.fn()

            navigator.onRouteChange!(callback)

            expect(windowAddEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function))
        })

        it('should return an unsubscribe function that removes the listener', () => {
            const navigator = createReactRouterNavigator(mockNavigate, mockLocation)
            const callback = vi.fn()

            const unsubscribe = navigator.onRouteChange!(callback)
            unsubscribe()

            expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function))
        })
    })

    describe('back', () => {
        it('should call navigate with -1', () => {
            const navigator = createReactRouterNavigator(mockNavigate, mockLocation)

            navigator.back!()

            expect(mockNavigate).toHaveBeenCalledWith(-1)
        })
    })

    describe('prefetch', () => {
        it('should not have prefetch implemented', () => {
            const navigator = createReactRouterNavigator(mockNavigate, mockLocation)

            // React Router doesn't have built-in prefetch
            expect(navigator.prefetch).toBeUndefined()
        })
    })
})
