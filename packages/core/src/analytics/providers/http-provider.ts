import { AnalyticsEvent, AnalyticsProvider } from '../types'
import { Logger } from '../../services'

export interface HttpProviderConfig {
    publicKey: string
    apiHost: string
    batchSize?: number
    batchInterval?: number
    headers?: Record<string, string>
    debug?: boolean
}

export class HttpProvider implements AnalyticsProvider {
    readonly name = 'onboardjs-cloud'
    private _config: HttpProviderConfig
    private _queue: AnalyticsEvent[] = []
    private _flushTimer: any
    private _isFlushing = false
    private _logger: Logger

    constructor(config: HttpProviderConfig) {
        this._logger = new Logger({ prefix: '[HttpProvider]' })
        this._config = {
            batchSize: 10,
            batchInterval: 2000,
            ...config,
        }

        if (typeof window !== 'undefined') {
            this._flushTimer = setInterval(() => this.flush(), this._config.batchInterval)
        }
    }

    trackEvent(event: AnalyticsEvent): void {
        this._queue.push(event)

        if (this._queue.length >= this._config.batchSize!) {
            this.flush()
        }
    }

    async flush(): Promise<void> {
        if (this._isFlushing || this._queue.length === 0) return
        this._isFlushing = true

        const eventsToSend = [...this._queue]
        this._queue = []

        try {
            if (typeof window === 'undefined') {
                // Server-side - store events for later or use a Node fetch polyfill
                return
            }

            const response = await fetch(`${this._config.apiHost}/api/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-OnboardJS-Key': this._config.publicKey,
                    ...this._config.headers,
                },
                body: JSON.stringify({ events: eventsToSend }),
            })

            if (!response.ok) {
                throw new Error(`Analytics API error: ${response.status}`)
            }
        } catch (error) {
            // Add failed events back to the queue
            this._queue = [...eventsToSend, ...this._queue]
            if (this._config.debug) {
                this._logger.error('Error sending analytics events:', error)
            }
        } finally {
            this._isFlushing = false
        }
    }

    dispose(): void {
        if (this._flushTimer) {
            clearInterval(this._flushTimer)
        }
        this.flush()
    }
}
