// src/analytics/aha-tracker/index.ts

export * from './types'
export { AhaTracker } from './tracker'

import { AhaTracker } from './tracker'
import { TrackAhaParams, AhaEvent } from './types'

/**
 * Track an aha moment from anywhere in your application
 *
 * **Server-side usage** (Next.js Server Actions, API routes, etc.):
 * ```typescript
 * import { aha } from '@onboardjs/core'
 *
 * export async function generateVideo(userId: string, imageUrl: string) {
 *   const video = await aiService.generate(imageUrl)
 *
 *   // User saw the value - track aha moment
 *   await aha({
 *     aha_type: 'value_demonstration',
 *     user_id: userId, // REQUIRED on server-side
 *     context: {
 *       feature_name: 'video_generation',
 *       product_area: 'ai_studio'
 *     }
 *   })
 *
 *   return video
 * }
 * ```
 *
 * **Client-side usage** (React components, hooks, etc.):
 * ```typescript
 * import { aha, AhaTracker } from '@onboardjs/core'
 * import { useOnboarding } from '@onboardjs/react'
 *
 * // Option 1: Link to OnboardingEngine (recommended)
 * function App() {
 *   const { engine } = useOnboarding()
 *
 *   useEffect(() => {
 *     const tracker = AhaTracker.getInstance()
 *     tracker.linkToEngine({
 *       getUserId: () => engine.getContext().userId,
 *       getFlowData: () => ({
 *         flow_id: 'video_onboarding',
 *         current_step_id: engine.getState().currentStep?.id
 *       })
 *     })
 *   }, [engine])
 * }
 *
 * // Now you can call aha() without user_id
 * function VideoPlayer({ videoUrl }) {
 *   const handleDownload = async () => {
 *     await downloadVideo(videoUrl)
 *
 *     // User_id auto-detected from linked engine
 *     await aha({
 *       aha_type: 'value_demonstration',
 *       context: { feature_name: 'video_download' }
 *     })
 *   }
 *
 *   return <button onClick={handleDownload}>Download</button>
 * }
 *
 * // Option 2: Explicit user_id (works anywhere)
 * function VideoPlayer({ videoUrl, userId }) {
 *   const handleDownload = async () => {
 *     await downloadVideo(videoUrl)
 *
 *     await aha({
 *       aha_type: 'value_demonstration',
 *       user_id: userId, // Explicit
 *       context: { feature_name: 'video_download' }
 *     })
 *   }
 *
 *   return <button onClick={handleDownload}>Download</button>
 * }
 * ```
 */
export async function aha(params: TrackAhaParams): Promise<AhaEvent | null> {
    return AhaTracker.getInstance().track(params)
}
