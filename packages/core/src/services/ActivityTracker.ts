import { EventManager } from '../engine/EventManager'
import { OnboardingContext, OnboardingStep } from '../types'

export class ActivityTracker<TContext extends OnboardingContext> {
    private _lastActivity = Date.now()
    private _idleTimeout: ReturnType<typeof setTimeout> | null = null
    private _isIdle = false
    private readonly _IDLE_THRESHOLD = 30000 // 30 seconds

    constructor(
        private _eventManager: EventManager<TContext>,
        private _getCurrentStep: () => OnboardingStep<TContext> | null,
        private _getContext: () => TContext
    ) {
        this._setupActivityListeners()
    }

    private _setupActivityListeners(): void {
        if (typeof window !== 'undefined') {
            ;['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach((event) => {
                document.addEventListener(event, this._handleActivity.bind(this), true)
            })
        }
    }

    private _handleActivity(): void {
        const now = Date.now()
        const wasIdle = this._isIdle

        if (wasIdle) {
            const awayDuration = now - this._lastActivity
            const currentStep = this._getCurrentStep()
            if (currentStep) {
                this._eventManager.notifyListeners('userReturned', {
                    step: currentStep,
                    context: this._getContext(),
                    awayDuration,
                })
            }
            this._isIdle = false
        }

        this._lastActivity = now
        this._resetIdleTimer()
    }

    private _resetIdleTimer(): void {
        if (this._idleTimeout) {
            clearTimeout(this._idleTimeout)
        }

        this._idleTimeout = setTimeout(() => {
            const currentStep = this._getCurrentStep()
            if (currentStep && !this._isIdle) {
                const idleDuration = Date.now() - this._lastActivity
                this._eventManager.notifyListeners('userIdle', {
                    step: currentStep,
                    context: this._getContext(),
                    idleDuration,
                })
                this._isIdle = true
            }
        }, this._IDLE_THRESHOLD)
    }

    cleanup(): void {
        if (this._idleTimeout) {
            clearTimeout(this._idleTimeout)
        }

        if (typeof window !== 'undefined') {
            ;['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach((event) => {
                document.removeEventListener(event, this._handleActivity.bind(this), true)
            })
        }
    }
}
