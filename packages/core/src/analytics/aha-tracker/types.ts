// src/analytics/aha-tracker/types.ts

/**
 * Represents the type of aha moment reached by the user
 */
export type AhaType =
    | 'feature_activation' // Completed first core action
    | 'workflow_completion' // Finished essential workflow
    | 'value_demonstration' // Received tangible outcome
    | 'engagement_threshold' // Crossed usage milestone
    | 'setup_completion' // Finished critical configuration
    | 'collaboration_start' // First team/social interaction
    | 'custom' // Custom aha moment defined by the developer

/**
 * Journey stage when the aha moment occurs
 */
export type JourneyStage = 'activation' | 'adoption' | 'retention' | 'expansion'

/**
 * Metrics tracked for the aha moment
 */
export interface AhaMetrics {
    // Time-based
    time_to_aha_seconds: number // From signup/session start
    time_since_signup_seconds?: number // From account creation
    session_duration_seconds?: number // Current session length

    // Engagement
    actions_before_aha?: number // Interaction count
    steps_completed?: number // Onboarding steps done
    features_explored?: number // Unique features touched

    // Depth
    engagement_score?: number // 0-100 composite score
    completion_rate?: number // % of onboarding done (0-1)

    // Predictive (optional ML score)
    retention_likelihood?: number // 0-1
}

/**
 * Context information about the aha moment
 */
export interface AhaContext {
    // Product Context
    feature_name?: string // Which feature triggered
    feature_category?: string // Feature grouping
    product_area?: string // Section of app

    // User Context
    user_role?: string // From onboarding flow or app
    user_segment?: string // Cohort/persona
    plan_type?: string // Free, Pro, Enterprise
    is_trial?: boolean

    // Technical Context
    platform?: 'web' | 'mobile' | 'desktop'
    device_type?: 'mobile' | 'tablet' | 'desktop'
    browser?: string
    os?: string
    app_version?: string

    // Behavioral Context
    referral_source?: string // How they arrived
    previous_aha_events?: number // If multi-aha model
    first_aha?: boolean // Is this their first?

    // Custom properties
    [key: string]: any
}

/**
 * Experiment/A-B test data
 */
export interface ExperimentData {
    experiment_id: string
    experiment_name: string
    variant_id: string
    variant_name: string
    started_at?: string // ISO 8601
}

/**
 * Onboarding flow data (if triggered from within a flow)
 */
export interface OnboardingFlowData {
    flow_id?: string // Unique flow identifier
    flow_version?: string // Flow config version
    current_step_id?: string // Step that triggered aha
    current_step_index?: number // 0-based position
    total_steps?: number // Flow length
    steps_completed?: string[] // IDs of completed steps
    steps_skipped?: string[] // IDs of skipped steps
    flow_started_at?: string // ISO 8601
    custom_flow_data?: Record<string, unknown> // From context.flowData
}

/**
 * Complete aha event payload
 */
export interface AhaEvent {
    // Event Identification
    event_name: 'onboarding_aha_moment'
    event_version: string // e.g., '1.0.0'

    // User & Session
    user_id?: string
    anonymous_id?: string // For pre-auth tracking
    session_id?: string

    // Timing
    timestamp: string // ISO 8601
    client_timestamp: string // ISO 8601
    timezone: string // e.g., 'America/New_York'

    // Aha Moment Details
    aha_type: AhaType
    journey_stage: JourneyStage
    aha_description?: string // Human-readable description

    // Journey Metrics
    metrics: AhaMetrics

    // Context
    context: AhaContext

    // Experimentation (optional)
    experiments?: ExperimentData[]

    // OnboardJS Specific (optional - only if triggered from within flow)
    onboarding_flow?: OnboardingFlowData
}

/**
 * Configuration for aha tracking
 */
export interface AhaTrackerConfig {
    // Event versioning
    event_version?: string // Default: '1.0.0'

    // Deduplication
    max_events_per_user?: number // Limit aha events per user (undefined = no limit)
    cooldown_seconds?: number // Minimum time between aha events (undefined = no cooldown)

    // Session tracking (client-side only)
    session_id?: string // Override session ID
    session_start_time?: number // For time_to_aha calculation

    // User tracking
    user_signup_time?: number // For time_since_signup calculation

    // Debug
    debug?: boolean

    // Privacy
    exclude_personal_data?: boolean
    sanitize_context?: (context: AhaContext) => AhaContext

    // Custom providers (in addition to AnalyticsManager)
    custom_providers?: import('../types').AnalyticsProvider[]
}

/**
 * Engine context for auto-detection (client-side only)
 */
export interface EngineContext {
    getUserId: () => string | undefined
    getFlowData: () => OnboardingFlowData | undefined
}

/**
 * Parameters for tracking an aha moment
 *
 * **Server-side**: `user_id` or `anonymous_id` is REQUIRED
 * **Client-side**: `user_id` is optional if tracker is linked to OnboardingEngine
 */
export interface TrackAhaParams {
    // Required
    aha_type: AhaType
    journey_stage?: JourneyStage // Default: 'activation'

    // Optional
    aha_description?: string

    /**
     * User identifier
     *
     * **REQUIRED on server-side** (API routes, Server Actions, etc.)
     *
     * **Optional on client-side** if AhaTracker is linked to OnboardingEngine
     * via `tracker.linkToEngine({ getUserId: () => ... })`
     *
     * @example
     * ```typescript
     * // Server-side (Next.js Server Action)
     * await aha({
     *   aha_type: 'value_demonstration',
     *   user_id: session.user.id // REQUIRED
     * })
     *
     * // Client-side with linked engine
     * await aha({
     *   aha_type: 'feature_activation'
     *   // user_id auto-detected from engine
     * })
     * ```
     */
    user_id?: string

    /**
     * Anonymous identifier for pre-auth tracking
     * Can be used instead of user_id for anonymous users
     */
    anonymous_id?: string

    // Metrics (will be auto-calculated if not provided)
    metrics?: Partial<AhaMetrics>

    // Context
    context?: AhaContext

    // Experiments
    experiments?: ExperimentData[]

    // Timing overrides
    custom_timestamp?: Date | string

    // Flow context (auto-populated if called from within flow)
    flow_id?: string
}

/**
 * User aha statistics
 */
export interface AhaUserStats {
    total_aha_events: number
    last_aha_time: number | null
    can_track_aha: boolean
}
