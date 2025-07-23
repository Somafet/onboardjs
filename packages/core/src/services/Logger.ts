export interface LoggerConfig {
  /**
   * Enables or disables debug logging.
   * If true, debug messages will be outputted.
   * Defaults to false if not provided.
   */
  debugMode?: boolean;

  /**
   * An optional prefix to add to all log messages.
   */
  prefix?: string;
}

export class Logger {
  private debugEnabled: boolean;
  private logPrefix: string;

  /**
   * Creates an instance of Logger.
   * @param config The configuration object for the logger.
   */
  constructor(config?: LoggerConfig) {
    this.debugEnabled = config?.debugMode ?? false;
    // Ensure prefix is a string, default to empty if not provided or not a string
    this.logPrefix =
      typeof config?.prefix === "string" ? `${config.prefix}` : "";

    // Add a space if a prefix exists to separate it from the message
    if (this.logPrefix) {
      this.logPrefix = `${this.logPrefix} `;
    }
  }

  /**
   * Logs a debug message. Only visible if `debugMode` is true.
   * @param messages The messages to log.
   */
  public debug(...messages: any[]): void {
    if (this.debugEnabled) {
      console.log(`${this.logPrefix}[DEBUG]`, ...messages);
    }
  }

  /**
   * Logs an informational message.
   * @param messages The messages to log.
   */
  public info(...messages: any[]): void {
    console.info(`${this.logPrefix}[INFO]`, ...messages);
  }

  /**
   * Logs a warning message.
   * @param messages The messages to log.
   */
  public warn(...messages: any[]): void {
    console.warn(`${this.logPrefix}[WARN]`, ...messages);
  }

  /**
   * Logs an error message.
   * @param messages The messages to log.
   */
  public error(...messages: any[]): void {
    console.error(`${this.logPrefix}[ERROR]`, ...messages);
  }
}
