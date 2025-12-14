export interface LoggerConfig {
    /**
     * Enables or disables debug logging.
     * If true, debug messages will be outputted.
     * Defaults to false if not provided.
     */
    debugMode?: boolean

    /**
     * An optional prefix to add to all log messages.
     */
    prefix?: string
}

export class Logger {
    private static _instance: Logger | null = null
    private static _instanceCache = new Map<string, Logger>()

    private _debugEnabled: boolean
    private _logPrefix: string

    /**
     * Creates an instance of Logger.
     * @param config The configuration object for the logger.
     */
    constructor(config?: LoggerConfig) {
        this._debugEnabled = config?.debugMode ?? false
        // Ensure prefix is a string, default to empty if not provided or not a string
        this._logPrefix = typeof config?.prefix === 'string' ? `${config.prefix}` : ''

        // Add a space if a prefix exists to separate it from the message
        if (this._logPrefix) {
            this._logPrefix = `${this._logPrefix} `
        }
    }

    /**
     * Gets the singleton instance of Logger with optional configuration.
     * If called without arguments, returns the default singleton instance.
     * If called with a prefix, returns a cached instance for that prefix.
     *
     * @param config Optional configuration for the logger instance
     * @returns A Logger instance (singleton or cached by prefix)
     *
     * @example
     * ```typescript
     * // Get default singleton
     * const logger = Logger.getInstance()
     *
     * // Get or create cached instance with prefix
     * const myLogger = Logger.getInstance({ prefix: 'MyService' })
     *
     * // Same prefix returns the same cached instance
     * const sameLogger = Logger.getInstance({ prefix: 'MyService' })
     * console.log(myLogger === sameLogger) // true
     * ```
     */
    public static getInstance(config?: LoggerConfig): Logger {
        // If no config provided, return the default singleton
        if (!config) {
            if (!Logger._instance) {
                Logger._instance = new Logger()
            }
            return Logger._instance
        }

        // Create cache key from config
        const cacheKey = `${config.debugMode ?? false}:${config.prefix ?? ''}`

        // Return cached instance if exists
        if (Logger._instanceCache.has(cacheKey)) {
            return Logger._instanceCache.get(cacheKey)!
        }

        // Create new instance and cache it
        const instance = new Logger(config)
        Logger._instanceCache.set(cacheKey, instance)
        return instance
    }

    /**
     * Clears all cached Logger instances.
     * Useful for testing or when you need to reset logger configuration.
     *
     * @example
     * ```typescript
     * // In tests
     * afterEach(() => {
     *   Logger.clearCache()
     * })
     * ```
     */
    public static clearCache(): void {
        Logger._instance = null
        Logger._instanceCache.clear()
    }

    /**
     * Logs a debug message. Only visible if `debugMode` is true.
     * @param messages The messages to log.
     */
    public debug(...messages: any[]): void {
        if (this._debugEnabled) {
            // eslint-disable-next-line no-console
            console.log(`${this._logPrefix}[DEBUG]`, ...messages)
        }
    }

    /**
     * Logs an informational message.
     * @param messages The messages to log.
     */
    public info(...messages: any[]): void {
        console.info(`${this._logPrefix}[INFO]`, ...messages)
    }

    /**
     * Logs a warning message.
     * @param messages The messages to log.
     */
    public warn(...messages: any[]): void {
        console.warn(`${this._logPrefix}[WARN]`, ...messages)
    }

    /**
     * Logs an error message.
     * @param messages The messages to log.
     */
    public error(...messages: any[]): void {
        console.error(`${this._logPrefix}[ERROR]`, ...messages)
    }
}
