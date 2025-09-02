import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BasePlugin } from './BasePlugin'
import type { OnboardingEngine } from '../engine/OnboardingEngine'
import type { OnboardingContext } from '../types'
import type { PluginHooks, PluginConfig, PluginCleanup } from './types'

// Mock OnboardingEngine
const mockEngine = {
    addBeforeStepChangeListener: vi.fn(() => vi.fn()),
    addAfterStepChangeListener: vi.fn(() => vi.fn()),
    addStepActiveListener: vi.fn(() => vi.fn()),
    addStepCompletedListener: vi.fn(() => vi.fn()),
    addFlowCompletedListener: vi.fn(() => vi.fn()),
    addContextUpdateListener: vi.fn(() => vi.fn()),
    addErrorListener: vi.fn(() => vi.fn()),
} as unknown as OnboardingEngine<OnboardingContext>

interface TestConfig extends PluginConfig {
    testValue?: string
    anotherValue?: number
}

class TestableBasePlugin extends BasePlugin<OnboardingContext, TestConfig> {
    public name = 'TestPlugin'
    public version = '1.0.0'
    public description = 'A testable plugin'
    public dependencies = ['another-plugin']

    public onInstallSpy = vi.fn(async () => {})
    public onUninstallSpy = vi.fn(async () => {})

    // To control hooks for testing
    public hooksToReturn: PluginHooks<OnboardingContext> = {}

    constructor(config: TestConfig = { testValue: 'default' }) {
        super(config)
    }

    protected async onInstall(): Promise<void> {
        await this.onInstallSpy()
    }

    protected async onUninstall(): Promise<void> {
        await this.onUninstallSpy()
    }

    protected getHooks(): PluginHooks<OnboardingContext> {
        return this.hooksToReturn
    }

    // Helper to access protected engine for assertions
    public getProtectedEngine(): OnboardingEngine<OnboardingContext> {
        return this.engine
    }

    // Helper to access private unsubscribeFunctions for assertions
    public getUnsubscribeFunctions(): (() => void)[] {
        // @ts-expect-error Accessing private member for testing
        return this.unsubscribeFunctions
    }

    public getConfig(): TestConfig {
        return super.getConfig()
    }

    public updateConfig(newConfig: Partial<TestConfig>): void {
        super.updateConfig(newConfig)
    }
}

describe('BasePlugin', () => {
    let plugin: TestableBasePlugin
    const initialConfig: TestConfig = { testValue: 'initial' }

    beforeEach(() => {
        plugin = new TestableBasePlugin(initialConfig)
        // Reset all spies on mockEngine before each test
        vi.mocked(mockEngine.addBeforeStepChangeListener).mockClear().mockReturnValue(vi.fn())
        vi.mocked(mockEngine.addAfterStepChangeListener).mockClear().mockReturnValue(vi.fn())
        vi.mocked(mockEngine.addStepActiveListener).mockClear().mockReturnValue(vi.fn())
        vi.mocked(mockEngine.addStepCompletedListener).mockClear().mockReturnValue(vi.fn())
        vi.mocked(mockEngine.addFlowCompletedListener).mockClear().mockReturnValue(vi.fn())
        vi.mocked(mockEngine.addContextUpdateListener).mockClear().mockReturnValue(vi.fn())
        vi.mocked(mockEngine.addErrorListener).mockClear().mockReturnValue(vi.fn())
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('should have name, version, description, and dependencies defined', () => {
        expect(plugin.name).toBe('TestPlugin')
        expect(plugin.version).toBe('1.0.0')
        expect(plugin.description).toBe('A testable plugin')
        expect(plugin.dependencies).toEqual(['another-plugin'])
    })

    describe('Constructor and Configuration', () => {
        it('should initialize with the provided config', () => {
            expect(plugin.getConfig()).toEqual(initialConfig)
        })

        it('should use default config if none provided', () => {
            const pluginWithDefaultConfig = new TestableBasePlugin()
            expect(pluginWithDefaultConfig.getConfig()).toEqual({
                testValue: 'default',
            })
        })

        it('getConfig should return the current configuration', () => {
            expect(plugin.getConfig()).toEqual(initialConfig)
            const newConfig: TestConfig = { testValue: 'updated' }
            plugin.updateConfig(newConfig)
            expect(plugin.getConfig()).toEqual({ ...initialConfig, ...newConfig })
        })

        it('updateConfig should merge new configuration with existing', () => {
            const updates: Partial<TestConfig> = { anotherValue: 123 }
            plugin.updateConfig(updates)
            expect(plugin.getConfig()).toEqual({ ...initialConfig, ...updates })

            const moreUpdates: Partial<TestConfig> = {
                testValue: 'final',
                anotherValue: 456,
            }
            plugin.updateConfig(moreUpdates)
            expect(plugin.getConfig()).toEqual({ ...initialConfig, ...moreUpdates })
        })
    })

    describe('install', () => {
        let cleanupFn: PluginCleanup

        beforeEach(async () => {
            cleanupFn = await plugin.install(mockEngine)
        })

        it('should set the engine property', () => {
            expect(plugin.getProtectedEngine()).toBe(mockEngine)
        })

        it('should call onInstall', () => {
            expect(plugin.onInstallSpy).toHaveBeenCalledTimes(1)
        })

        it('should call setupHooks (implicitly, by checking listener registrations)', () => {
            plugin.hooksToReturn = { onFlowCompleted: vi.fn() }
            // Re-install to trigger setupHooks with new hooks
            plugin.install(mockEngine)
            expect(mockEngine.addFlowCompletedListener).toHaveBeenCalled()
        })

        it('should return a cleanup function', () => {
            expect(typeof cleanupFn).toBe('function')
        })

        describe('Returned Cleanup Function', () => {
            let unsubscribeSpy: () => void
            let savedUnsubscribeFunctions: (() => void)[]
            beforeEach(async () => {
                // Reset spies for this specific context
                plugin.onUninstallSpy.mockClear()
                unsubscribeSpy = vi.fn()

                savedUnsubscribeFunctions = [unsubscribeSpy, vi.fn()]

                // @ts-expect-error Accessing private member for testing
                plugin.unsubscribeFunctions = savedUnsubscribeFunctions

                await cleanupFn()
            })

            it('should call onUninstall', () => {
                expect(plugin.onUninstallSpy).toHaveBeenCalledTimes(1)
            })

            it('should call all stored unsubscribe functions', () => {
                expect(unsubscribeSpy).toHaveBeenCalledTimes(1)
                expect(savedUnsubscribeFunctions[1]).toHaveBeenCalledTimes(1)
            })

            it('should clear the unsubscribeFunctions array', () => {
                expect(plugin.getUnsubscribeFunctions()).toHaveLength(0)
            })
        })
    })

    describe('setupHooks', () => {
        it('should not register any listeners if getHooks returns empty', async () => {
            plugin.hooksToReturn = {}
            await plugin.install(mockEngine) // install calls setupHooks

            expect(mockEngine.addBeforeStepChangeListener).not.toHaveBeenCalled()
            expect(mockEngine.addAfterStepChangeListener).not.toHaveBeenCalled()
            expect(mockEngine.addStepActiveListener).not.toHaveBeenCalled()
            expect(mockEngine.addStepCompletedListener).not.toHaveBeenCalled()
            expect(mockEngine.addFlowCompletedListener).not.toHaveBeenCalled()
            expect(mockEngine.addContextUpdateListener).not.toHaveBeenCalled()
            expect(mockEngine.addErrorListener).not.toHaveBeenCalled()
            expect(plugin.getUnsubscribeFunctions()).toHaveLength(0)
        })

        it('should register all provided hooks and store their unsubscribe functions', async () => {
            const mockBeforeStepChange = vi.fn()
            const mockAfterStepChange = vi.fn()
            const mockOnStepActive = vi.fn()
            const mockOnStepCompleted = vi.fn()
            const mockOnFlowCompleted = vi.fn()
            const mockOnContextUpdate = vi.fn()
            const mockOnError = vi.fn()

            plugin.hooksToReturn = {
                beforeStepChange: mockBeforeStepChange,
                afterStepChange: mockAfterStepChange,
                onStepActive: mockOnStepActive,
                onStepCompleted: mockOnStepCompleted,
                onFlowCompleted: mockOnFlowCompleted,
                onContextUpdate: mockOnContextUpdate,
                onError: mockOnError,
            }

            const unsubBefore = vi.fn()
            const unsubAfter = vi.fn()
            const unsubActive = vi.fn()
            const unsubComplete = vi.fn()
            const unsubFlow = vi.fn()
            const unsubContext = vi.fn()
            const unsubError = vi.fn()

            vi.mocked(mockEngine.addBeforeStepChangeListener).mockReturnValue(unsubBefore)
            vi.mocked(mockEngine.addAfterStepChangeListener).mockReturnValue(unsubAfter)
            vi.mocked(mockEngine.addStepActiveListener).mockReturnValue(unsubActive)
            vi.mocked(mockEngine.addStepCompletedListener).mockReturnValue(unsubComplete)
            vi.mocked(mockEngine.addFlowCompletedListener).mockReturnValue(unsubFlow)
            vi.mocked(mockEngine.addContextUpdateListener).mockReturnValue(unsubContext)
            vi.mocked(mockEngine.addErrorListener).mockReturnValue(unsubError)

            await plugin.install(mockEngine)

            expect(mockEngine.addBeforeStepChangeListener).toHaveBeenCalledWith(mockBeforeStepChange)
            expect(mockEngine.addAfterStepChangeListener).toHaveBeenCalledWith(mockAfterStepChange)
            expect(mockEngine.addStepActiveListener).toHaveBeenCalledWith(mockOnStepActive)
            expect(mockEngine.addStepCompletedListener).toHaveBeenCalledWith(mockOnStepCompleted)
            expect(mockEngine.addFlowCompletedListener).toHaveBeenCalledWith(mockOnFlowCompleted)
            expect(mockEngine.addContextUpdateListener).toHaveBeenCalledWith(mockOnContextUpdate)
            expect(mockEngine.addErrorListener).toHaveBeenCalledWith(mockOnError)

            const unsubscribeFunctions = plugin.getUnsubscribeFunctions()
            expect(unsubscribeFunctions).toHaveLength(7)
            expect(unsubscribeFunctions).toContain(unsubBefore)
            expect(unsubscribeFunctions).toContain(unsubAfter)
            expect(unsubscribeFunctions).toContain(unsubActive)
            expect(unsubscribeFunctions).toContain(unsubComplete)
            expect(unsubscribeFunctions).toContain(unsubFlow)
            expect(unsubscribeFunctions).toContain(unsubContext)
            expect(unsubscribeFunctions).toContain(unsubError)
        })

        it('should only register hooks that are provided', async () => {
            const mockOnStepActive = vi.fn()
            plugin.hooksToReturn = {
                onStepActive: mockOnStepActive,
            }
            const unsubActive = vi.fn()
            vi.mocked(mockEngine.addStepActiveListener).mockReturnValue(unsubActive)

            await plugin.install(mockEngine)

            expect(mockEngine.addBeforeStepChangeListener).not.toHaveBeenCalled()
            expect(mockEngine.addAfterStepChangeListener).not.toHaveBeenCalled()
            expect(mockEngine.addStepActiveListener).toHaveBeenCalledWith(mockOnStepActive)
            expect(mockEngine.addStepCompletedListener).not.toHaveBeenCalled()
            expect(mockEngine.addFlowCompletedListener).not.toHaveBeenCalled()
            expect(mockEngine.addContextUpdateListener).not.toHaveBeenCalled()
            expect(mockEngine.addErrorListener).not.toHaveBeenCalled()

            const unsubscribeFunctions = plugin.getUnsubscribeFunctions()
            expect(unsubscribeFunctions).toHaveLength(1)
            expect(unsubscribeFunctions).toContain(unsubActive)
        })
    })

    describe('Lifecycle: onInstall, onUninstall (as implemented by TestableBasePlugin)', () => {
        it('onInstall should be called during plugin.install()', async () => {
            plugin.onInstallSpy.mockClear() // Clear from previous install in beforeEach
            await plugin.install(mockEngine)
            expect(plugin.onInstallSpy).toHaveBeenCalledTimes(1)
        })

        it('onUninstall should be called by the cleanup function returned from plugin.install()', async () => {
            const cleanupFn = await plugin.install(mockEngine)
            plugin.onUninstallSpy.mockClear() // Clear from potential previous calls if any test setup was different
            await cleanupFn()
            expect(plugin.onUninstallSpy).toHaveBeenCalledTimes(1)
        })
    })

    describe('Default implementations of overridable methods', () => {
        class DefaultPlugin extends BasePlugin<OnboardingContext, PluginConfig> {
            name = 'DefaultPlugin'
            version = '0.0.1'
            constructor() {
                super({})
            }
            // Using default getHooks, onInstall, onUninstall
        }
        let defaultPlugin: DefaultPlugin

        beforeEach(() => {
            defaultPlugin = new DefaultPlugin()
        })

        it('default getHooks should return an empty object', () => {
            // @ts-expect-error Accessing protected method
            expect(defaultPlugin.getHooks()).toEqual({})
        })

        it('default onInstall should resolve without error', async () => {
            // @ts-expect-error Accessing protected method
            await expect(defaultPlugin.onInstall()).resolves.toBeUndefined()
        })

        it('default onUninstall should resolve without error', async () => {
            // @ts-expect-error Accessing protected method
            await expect(defaultPlugin.onUninstall()).resolves.toBeUndefined()
        })

        it('installing a plugin with default hooks should not register listeners', async () => {
            await defaultPlugin.install(mockEngine)
            expect(mockEngine.addBeforeStepChangeListener).not.toHaveBeenCalled()
            // ... (check other listeners not called)
            // @ts-expect-error Accessing private member for testing
            expect(defaultPlugin.unsubscribeFunctions).toHaveLength(0)
        })
    })
})
