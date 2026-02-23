---
'@onboardjs/core': patch
'@onboardjs/react': patch
---

Fix React 18 Strict Mode race condition causing isHydrating to get stuck

This fix addresses two overlapping issues:

1. **Race condition in useEngineLifecycle.ts**: Replaced shared `useRef` with an effect-scoped flag to prevent orphaned promises from previous effect runs from updating state during Strict Mode double-mounting.

2. **Missing state notification in OnboardingEngine.ts**: Added `notifyStateChange` call in the `finally` block of `_initializeEngine` to ensure React and other subscribers are notified when hydration completes.
