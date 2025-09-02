import { AnalyticsEvent, AnalyticsProvider } from '../types'

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
    private config: HttpProviderConfig
    private queue: AnalyticsEvent[] = []
    private flushTimer: any
    private isFlushing = false

    constructor(config: HttpProviderConfig) {
        this.config = {
            batchSize: 10,
            batchInterval: 2000,
            ...config,
        }

        if (typeof window !== 'undefined') {
            this.flushTimer = setInterval(() => this.flush(), this.config.batchInterval)
        }
    }

    trackEvent(event: AnalyticsEvent): void {
        this.queue.push(event)

        if (this.queue.length >= this.config.batchSize!) {
            this.flush()
        }
    }

    async flush(): Promise<void> {
        if (this.isFlushing || this.queue.length === 0) return
        this.isFlushing = true

        const eventsToSend = [...this.queue]
        this.queue = []

        try {
            if (typeof window === 'undefined') {
                // Server-side - store events for later or use a Node fetch polyfill
                return
            }

            const response = await fetch(`${this.config.apiHost}/api/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-OnboardJS-Key': this.config.publicKey,
                    ...this.config.headers,
                },
                body: JSON.stringify({ events: eventsToSend }),
            })

            if (!response.ok) {
                throw new Error(`Analytics API error: ${response.status}`)
            }
        } catch (error) {
            // Add failed events back to the queue
            this.queue = [...eventsToSend, ...this.queue]
            if (this.config.debug) {
                console.error('Error sending analytics events:', error)
            }
        } finally {
            this.isFlushing = false
        }
    }

    dispose(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer)
        }
        this.flush()
    }
}
