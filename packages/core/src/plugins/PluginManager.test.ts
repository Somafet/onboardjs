import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PluginManagerImpl } from './PluginManager' // Adjust path as needed
import type { OnboardingPlugin, PluginCleanup } from './types' // Adjust path
import type { OnboardingEngine } from '../engine/OnboardingEngine' // Adjust path
import type { OnboardingContext } from '../types' // Adjust path

// Mock OnboardingEngine - for PluginManager tests, it's mostly a passthrough object.
const mockEngine = {} as OnboardingEngine<OnboardingContext>

// Helper to create mock plugins
const createMockPlugin = (
    name: string,
    version: string = '1.0.0',
    dependencies: string[] = [],
    installFn?: (engine: OnboardingEngine<OnboardingContext>) => PluginCleanup | Promise<PluginCleanup>,
    description?: string
): OnboardingPlugin<OnboardingContext> => {
    return {
        name,
        version,
        description: description || `${name} plugin description`,
        dependencies,
        // Default install is async and returns an async cleanup mock
        install: installFn ? installFn : vi.fn(async () => vi.fn(async () => {})),
    }
}

describe('PluginManagerImpl', () => {
    let pluginManager: PluginManagerImpl<OnboardingContext>
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>
    let consoleDebugSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        pluginManager = new PluginManagerImpl<OnboardingContext>(mockEngine)
        // Spy on console methods to check for logging
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    })

    afterEach(() => {
        // Restore original console methods and clear all mocks
        consoleErrorSpy.mockRestore()
        consoleDebugSpy.mockRestore()
        vi.clearAllMocks()
    })

    describe('install', () => {
        it('should install a plugin successfully and log debug message', async () => {
            const mockInstallFn = vi.fn(async () => async () => {}) // Async install, async cleanup
            const plugin = createMockPlugin('test-plugin', '1.0.0', [], mockInstallFn)

            await pluginManager.install(plugin)

            expect(mockInstallFn).toHaveBeenCalledWith(mockEngine)
            expect(pluginManager.isInstalled('test-plugin')).toBe(true)
            expect(pluginManager.getInstalledPlugins()).toHaveLength(1)
            expect(pluginManager.getPlugin('test-plugin')).toBe(plugin)
        })

        it("should store the cleanup function returned by plugin's install and call it on uninstall", async () => {
            const mockCleanupFn = vi.fn(async () => {})
            const plugin = createMockPlugin(
                'cleanup-plugin',
                '1.0.0',
                [],
                async () => mockCleanupFn // Install returns the mockCleanupFn
            )

            await pluginManager.install(plugin)
            await pluginManager.uninstall('cleanup-plugin') // Trigger cleanup
            expect(mockCleanupFn).toHaveBeenCalled()
        })

        it('should throw an error if trying to install an already installed plugin', async () => {
            const plugin = createMockPlugin('duplicate-plugin')
            await pluginManager.install(plugin) // First install

            await expect(pluginManager.install(plugin)).rejects.toThrowError(
                'Plugin "duplicate-plugin" is already installed'
            )
            expect(consoleErrorSpy).not.toHaveBeenCalled()
        })

        it('should throw an error if a plugin dependency is not met', async () => {
            const pluginWithDep = createMockPlugin('dependent-plugin', '1.0.0', ['missing-dep'])
            await expect(pluginManager.install(pluginWithDep)).rejects.toThrowError(
                'Plugin "dependent-plugin" requires dependency "missing-dep" which is not installed'
            )
            expect(pluginManager.isInstalled('dependent-plugin')).toBe(false)
            // This error is thrown before the try-catch in PluginManagerImpl's install that logs to console.error
            expect(consoleErrorSpy).not.toHaveBeenCalled()
        })

        it('should install a plugin if its dependencies are met', async () => {
            const depPlugin = createMockPlugin('dep-base')
            const mainPlugin = createMockPlugin('dep-main', '1.0.0', ['dep-base'])

            await pluginManager.install(depPlugin)
            await pluginManager.install(mainPlugin)

            expect(pluginManager.isInstalled('dep-main')).toBe(true)
            expect(pluginManager.getInstalledPlugins()).toHaveLength(2)
        })

        it("should handle errors thrown by a plugin's install method and log to console.error", async () => {
            const erroringInstallFn = vi.fn(async () => {
                throw new Error('Plugin install failed intentionally')
            })
            const plugin = createMockPlugin('error-plugin', '1.0.0', [], erroringInstallFn)

            await expect(pluginManager.install(plugin)).rejects.toThrowError('Plugin install failed intentionally')
            expect(pluginManager.isInstalled('error-plugin')).toBe(false)
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('PluginManager [ERROR]'),
                'Failed to install plugin "error-plugin":',
                expect.any(Error)
            )
        })

        it('should correctly install a plugin with an async install method returning an async cleanup', async () => {
            const mockAsyncCleanupFn = vi.fn(async () => {})
            const asyncInstallFn = vi.fn(async () => {
                await new Promise((resolve) => setTimeout(resolve, 5)) // Simulate async work
                return mockAsyncCleanupFn
            })
            const plugin = createMockPlugin('async-install-plugin', '1.0.0', [], asyncInstallFn)

            await pluginManager.install(plugin)
            expect(asyncInstallFn).toHaveBeenCalledWith(mockEngine)
            expect(pluginManager.isInstalled('async-install-plugin')).toBe(true)

            // Verify cleanup is called
            await pluginManager.uninstall('async-install-plugin')
            expect(mockAsyncCleanupFn).toHaveBeenCalled()
        })

        it('should correctly install a plugin with a synchronous install method returning a synchronous cleanup', async () => {
            const mockSyncCleanupFn = vi.fn(() => {})
            const syncInstallFn = vi.fn(() => {
                // Synchronous install work
                return mockSyncCleanupFn // Returns a synchronous cleanup function
            })
            const plugin = createMockPlugin('sync-install-plugin', '1.0.0', [], syncInstallFn)

            // PluginManager's install is async due to `await plugin.install()`,
            // so we still await it even if the plugin's install is sync.
            await pluginManager.install(plugin)
            expect(syncInstallFn).toHaveBeenCalledWith(mockEngine)
            expect(pluginManager.isInstalled('sync-install-plugin')).toBe(true)

            // Verify cleanup is called
            await pluginManager.uninstall('sync-install-plugin')
            expect(mockSyncCleanupFn).toHaveBeenCalled()
        })
    })

    describe('uninstall', () => {
        it('should uninstall a plugin successfully, call its cleanup, and log debug message', async () => {
            const mockCleanupFn = vi.fn(async () => {})
            const plugin = createMockPlugin('uninstall-test', '1.0.0', [], async () => mockCleanupFn)
            await pluginManager.install(plugin) // Install first

            await pluginManager.uninstall('uninstall-test')

            expect(mockCleanupFn).toHaveBeenCalled()
            expect(pluginManager.isInstalled('uninstall-test')).toBe(false)
            expect(pluginManager.getInstalledPlugins()).toHaveLength(0)
        })

        it('should handle async cleanup functions correctly during uninstall', async () => {
            const mockAsyncCleanupFn = vi.fn(async () => {
                await new Promise((resolve) => setTimeout(resolve, 5))
            })
            const plugin = createMockPlugin('async-cleanup-plugin', '1.0.0', [], async () => mockAsyncCleanupFn)
            await pluginManager.install(plugin)
            await pluginManager.uninstall('async-cleanup-plugin')
            expect(mockAsyncCleanupFn).toHaveBeenCalled()
        })

        it('should handle synchronous cleanup functions correctly during uninstall', async () => {
            const mockSyncCleanupFn = vi.fn(() => {})
            const plugin = createMockPlugin(
                'sync-cleanup-plugin',
                '1.0.0',
                [],
                () => mockSyncCleanupFn // Sync install returns sync cleanup
            )
            await pluginManager.install(plugin)
            await pluginManager.uninstall('sync-cleanup-plugin')
            expect(mockSyncCleanupFn).toHaveBeenCalled()
        })

        it('should throw an error if trying to uninstall a non-existent plugin', async () => {
            await expect(pluginManager.uninstall('non-existent')).rejects.toThrowError(
                'Plugin "non-existent" is not installed'
            )
            expect(consoleErrorSpy).not.toHaveBeenCalled() // Error is thrown by PluginManager before try-catch
        })

        it('should throw an error if trying to uninstall a plugin that is a dependency for another installed plugin', async () => {
            const depPlugin = createMockPlugin('dep-A')
            const mainPlugin = createMockPlugin('main-B', '1.0.0', ['dep-A'])

            await pluginManager.install(depPlugin)
            await pluginManager.install(mainPlugin)

            await expect(pluginManager.uninstall('dep-A')).rejects.toThrowError(
                'Cannot uninstall "dep-A" because it is required by: main-B'
            )
            expect(pluginManager.isInstalled('dep-A')).toBe(true) // Should still be installed
            expect(consoleErrorSpy).not.toHaveBeenCalled()
        })

        it('should allow uninstalling a dependency if the dependent plugin is uninstalled first', async () => {
            const depCleanup = vi.fn(async () => {})
            const mainCleanup = vi.fn(async () => {})

            // Use specific mocks for this test's clarity
            const depPluginForTest = createMockPlugin('dep-C', '1.0.0', [], async () => depCleanup)
            const mainPluginForTest = createMockPlugin('main-D', '1.0.0', ['dep-C'], async () => mainCleanup)

            await pluginManager.install(depPluginForTest)
            await pluginManager.install(mainPluginForTest)

            await pluginManager.uninstall('main-D')
            expect(mainCleanup).toHaveBeenCalled()
            await pluginManager.uninstall('dep-C')
            expect(depCleanup).toHaveBeenCalled()

            expect(pluginManager.isInstalled('main-D')).toBe(false)
            expect(pluginManager.isInstalled('dep-C')).toBe(false)
        })

        it("should handle errors thrown by a plugin's cleanup method during uninstall and log to console.error", async () => {
            const erroringCleanupFn = vi.fn(async () => {
                throw new Error('Plugin cleanup failed intentionally')
            })
            const plugin = createMockPlugin('error-cleanup-plugin', '1.0.0', [], async () => erroringCleanupFn)
            await pluginManager.install(plugin)

            await expect(pluginManager.uninstall('error-cleanup-plugin')).rejects.toThrowError(
                'Plugin cleanup failed intentionally'
            )

            // Plugin should still be removed from the manager's internal list
            expect(pluginManager.isInstalled('error-cleanup-plugin')).toBe(false)
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('PluginManager [ERROR]'),
                'Failed to uninstall plugin "error-cleanup-plugin":',
                expect.any(Error)
            )
        })

        it("should successfully uninstall if plugin's install returned no cleanup function (undefined)", async () => {
            const plugin = createMockPlugin(
                'no-cleanup-plugin',
                '1.0.0',
                [],
                async () => () => undefined // Install returns undefined, meaning no cleanup
            )
            await pluginManager.install(plugin)
            await expect(pluginManager.uninstall('no-cleanup-plugin')).resolves.toBeUndefined()
            expect(pluginManager.isInstalled('no-cleanup-plugin')).toBe(false)
        })
    })

    describe('getPlugin / getInstalledPlugins / isInstalled', () => {
        it('getPlugin should return the plugin if installed, otherwise undefined', async () => {
            const plugin1 = createMockPlugin('plugin1')
            await pluginManager.install(plugin1)

            expect(pluginManager.getPlugin('plugin1')).toBe(plugin1)
            expect(pluginManager.getPlugin('non-existent-plugin')).toBeUndefined()
        })

        it('getInstalledPlugins should return an array of all installed plugins', async () => {
            const plugin1 = createMockPlugin('pluginA')
            const plugin2 = createMockPlugin('pluginB')
            await pluginManager.install(plugin1)
            await pluginManager.install(plugin2)

            const installed = pluginManager.getInstalledPlugins()
            expect(installed).toHaveLength(2)
            expect(installed).toEqual(expect.arrayContaining([plugin1, plugin2]))
        })

        it('getInstalledPlugins should return an empty array if no plugins are installed', () => {
            expect(pluginManager.getInstalledPlugins()).toEqual([])
        })

        it('isInstalled should return true for an installed plugin, false otherwise', async () => {
            const plugin1 = createMockPlugin('pluginX')
            await pluginManager.install(plugin1)

            expect(pluginManager.isInstalled('pluginX')).toBe(true)
            expect(pluginManager.isInstalled('pluginY')).toBe(false)
        })
    })

    describe('cleanup (manager global cleanup)', () => {
        it('should call the cleanup function for all installed plugins', async () => {
            const cleanup1 = vi.fn(async () => {})
            const cleanup2 = vi.fn(async () => await new Promise((r) => setTimeout(r, 5)))
            const plugin1 = createMockPlugin('cleanup-A', '1.0.0', [], async () => cleanup1)
            const plugin2 = createMockPlugin('cleanup-B', '1.0.0', [], async () => cleanup2)

            await pluginManager.install(plugin1)
            await pluginManager.install(plugin2)

            await pluginManager.cleanup()

            expect(cleanup1).toHaveBeenCalled()
            expect(cleanup2).toHaveBeenCalled()
        })

        it('should clear all plugins from the manager after successful global cleanup', async () => {
            const plugin1 = createMockPlugin('clear-A')
            const plugin2 = createMockPlugin('clear-B')
            await pluginManager.install(plugin1)
            await pluginManager.install(plugin2)

            await pluginManager.cleanup()

            expect(pluginManager.getInstalledPlugins()).toHaveLength(0)
            expect(pluginManager.isInstalled('clear-A')).toBe(false)
            expect(pluginManager.getPlugin('clear-A')).toBeUndefined()
        })

        it('should attempt all cleanups, reject if one fails, and NOT clear internal plugin maps', async () => {
            const successfulCleanup = vi.fn(async () => {})
            const failingCleanup = vi.fn(async () => {
                throw new Error('Async Cleanup Failed')
            })
            const anotherSuccessfulSyncCleanup = vi.fn(() => {})

            const pluginGood1 = createMockPlugin('good1', '1.0.0', [], async () => successfulCleanup)
            const pluginBad = createMockPlugin('bad', '1.0.0', [], async () => failingCleanup)
            const pluginGood2 = createMockPlugin('good2', '1.0.0', [], () => anotherSuccessfulSyncCleanup)

            await pluginManager.install(pluginGood1)
            await pluginManager.install(pluginBad)
            await pluginManager.install(pluginGood2)

            expect(pluginManager.getInstalledPlugins()).toHaveLength(3)

            await expect(pluginManager.cleanup()).rejects.toThrow('Async Cleanup Failed')

            // All cleanup functions should have been called because Promise.all initiates all promises/calls
            expect(successfulCleanup).toHaveBeenCalled()
            expect(failingCleanup).toHaveBeenCalled()
            expect(anotherSuccessfulSyncCleanup).toHaveBeenCalled()

            // Crucially, maps are NOT cleared if Promise.all rejects
            expect(pluginManager.getInstalledPlugins()).toHaveLength(3)
            expect(pluginManager.isInstalled('good1')).toBe(true)
            expect(pluginManager.isInstalled('bad')).toBe(true)
            expect(pluginManager.isInstalled('good2')).toBe(true)
            // PluginManager.cleanup itself doesn't log the error, it propagates it.
            expect(consoleErrorSpy).not.toHaveBeenCalled()
        })

        it('should handle a mix of sync and async cleanups successfully during global cleanup', async () => {
            const asyncCleanup = vi.fn(async () => {})
            const syncCleanup = vi.fn(() => {})

            const pluginAsync = createMockPlugin('p-async', '1.0.0', [], async () => asyncCleanup)
            const pluginSync = createMockPlugin('p-sync', '1.0.0', [], () => syncCleanup)

            await pluginManager.install(pluginAsync)
            await pluginManager.install(pluginSync)

            await pluginManager.cleanup()

            expect(asyncCleanup).toHaveBeenCalled()
            expect(syncCleanup).toHaveBeenCalled()
            expect(pluginManager.getInstalledPlugins()).toHaveLength(0)
        })

        it('should do nothing if no plugins are installed during global cleanup', async () => {
            await expect(pluginManager.cleanup()).resolves.toBeUndefined()
            expect(pluginManager.getInstalledPlugins()).toEqual([])
            expect(consoleErrorSpy).not.toHaveBeenCalled()
            expect(consoleDebugSpy).not.toHaveBeenCalled()
        })

        it('should gracefully handle plugins whose install returned no cleanup (undefined) during global cleanup', async () => {
            const cleanupForOne = vi.fn(async () => {})
            const pluginWithCleanup = createMockPlugin('with-cleanup', '1.0.0', [], async () => cleanupForOne)
            const pluginWithoutCleanup = createMockPlugin(
                'no-cleanup',
                '1.0.0',
                [],
                async () => () => undefined // Install returns undefined
            )

            await pluginManager.install(pluginWithCleanup)
            await pluginManager.install(pluginWithoutCleanup)

            // Assumes PluginManagerImpl.cleanup filters out non-function cleanups
            await expect(pluginManager.cleanup()).resolves.toBeUndefined()

            expect(cleanupForOne).toHaveBeenCalled()
            expect(pluginManager.getInstalledPlugins()).toHaveLength(0)
        })
    })
})
