// @onboardjs/react/src/adapters/next.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createNextNavigator, type NextAppRouter } from './next'

describe('createNextNavigator', () => {
    let mockRouter: NextAppRouter
    let windowAddEventListenerSpy: ReturnType<typeof vi.spyOn>
    let windowRemoveEventListenerSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        mockRouter = {
            push: vi.fn(),
            replace: vi.fn(),
            back: vi.fn(),
            prefetch: vi.fn(),
        }

        windowAddEventListenerSpy = vi.spyOn(window, 'addEventListener')
        windowRemoveEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('navigate', () => {
        it('should call router.push by default', () => {
            const navigator = createNextNavigator(mockRouter, '/current-path')

            navigator.navigate('/new-path')

            expect(mockRouter.push).toHaveBeenCalledWith('/new-path', { scroll: true })
            expect(mockRouter.replace).not.toHaveBeenCalled()
        })

        it('should call router.replace when replace option is true', () => {
            const navigator = createNextNavigator(mockRouter, '/current-path')

            navigator.navigate('/new-path', { replace: true })

            expect(mockRouter.replace).toHaveBeenCalledWith('/new-path', { scroll: true })
            expect(mockRouter.push).not.toHaveBeenCalled()
        })

        it('should pass scroll option to router', () => {
            const navigator = createNextNavigator(mockRouter, '/current-path')

            navigator.navigate('/new-path', { scroll: false })

            expect(mockRouter.push).toHaveBeenCalledWith('/new-path', { scroll: false })
        })

        it('should default scroll to true when not specified', () => {
            const navigator = createNextNavigator(mockRouter, '/current-path')

            navigator.navigate('/new-path', {})

            expect(mockRouter.push).toHaveBeenCalledWith('/new-path', { scroll: true })
        })
    })

    describe('getCurrentPath', () => {
        it('should return the provided pathname', () => {
            const navigator = createNextNavigator(mockRouter, '/current-path')

            expect(navigator.getCurrentPath()).toBe('/current-path')
        })

        it('should return different paths based on construction', () => {
            const navigator1 = createNextNavigator(mockRouter, '/path1')
            const navigator2 = createNextNavigator(mockRouter, '/path2')

            expect(navigator1.getCurrentPath()).toBe('/path1')
            expect(navigator2.getCurrentPath()).toBe('/path2')
        })
    })

    describe('onRouteChange', () => {
        it('should add a popstate event listener', () => {
            const navigator = createNextNavigator(mockRouter, '/current-path')
            const callback = vi.fn()

            navigator.onRouteChange!(callback)

            expect(windowAddEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function))
        })

        it('should return an unsubscribe function that removes the listener', () => {
            const navigator = createNextNavigator(mockRouter, '/current-path')
            const callback = vi.fn()

            const unsubscribe = navigator.onRouteChange!(callback)
            unsubscribe()

            expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function))
        })
    })

    describe('back', () => {
        it('should call router.back', () => {
            const navigator = createNextNavigator(mockRouter, '/current-path')

            navigator.back!()

            expect(mockRouter.back).toHaveBeenCalled()
        })
    })

    describe('prefetch', () => {
        it('should call router.prefetch with the path', () => {
            const navigator = createNextNavigator(mockRouter, '/current-path')

            navigator.prefetch!('/next-path')

            expect(mockRouter.prefetch).toHaveBeenCalledWith('/next-path')
        })
    })
})
