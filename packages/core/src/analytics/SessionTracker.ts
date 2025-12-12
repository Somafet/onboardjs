import { Logger } from '../services/Logger'
import { AnalyticsConfig } from './types'

/**
 * SessionTracker manages session lifecycle, sessionId generation and tracking,
 * and session-level metadata.
 */
export class SessionTracker {
    private _sessionId: string
    private _config: AnalyticsConfig
    private _logger: Logger
    private _flowInfo: {
        flowId?: string
        flowName?: string
        flowVersion?: string
        flowMetadata?: Record<string, unknown>
        instanceId?: number
    } = {}

    constructor(config: AnalyticsConfig = {}, logger?: Logger) {
        this._config = config
        this._logger = logger || new Logger({ debugMode: config.debug, prefix: 'SessionTracker' })
        this._sessionId = config.sessionId || `session_${Math.random().toString(36).slice(2)}`
    }

    getSessionId(): string {
        return this._sessionId
    }

    setUserId(userId: string): void {
        this._config.userId = userId
        this._logger.debug(`Session user ID set: ${userId}`)
    }

    setFlowId(flowId: string): void {
        this._config.flowId = flowId
        this._flowInfo.flowId = flowId
        this._logger.debug(`Session flow ID set: ${flowId}`)
    }

    setFlowInfo(flowInfo: {
        flowId?: string
        flowName?: string
        flowVersion?: string
        flowMetadata?: Record<string, unknown>
        instanceId?: number
    }): void {
        this._flowInfo = { ...this._flowInfo, ...flowInfo }
        if (flowInfo.flowId) {
            this._config.flowId = flowInfo.flowId
        }
        this._logger.debug('Session flow info updated', flowInfo)
    }

    getFlowInfo(): Readonly<typeof this._flowInfo> {
        return Object.freeze({ ...this._flowInfo })
    }

    getUserId(): string | undefined {
        return this._config.userId
    }

    getFlowId(): string | undefined {
        return this._config.flowId || this._flowInfo.flowId
    }

    getConfig(): Readonly<AnalyticsConfig> {
        return Object.freeze({ ...this._config })
    }
}
