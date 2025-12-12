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
