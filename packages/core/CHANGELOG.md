# @onboardjs/core

## 1.0.0-rc.5

### Patch Changes

- Security: `StepJSONParser` no longer uses a regular expression with polynomial backtracking to read function parameters (CodeQL `js/polynomial-redos`).

## 1.0.0-rc.4

### Patch Changes

- Fix missing state notification in `OnboardingEngine._initializeEngine`: added `notifyStateChange` call in the `finally` block so React and other subscribers are notified when hydration completes. ([#103](https://github.com/Somafet/onboardjs/pull/103))
