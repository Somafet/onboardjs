# @onboardjs/mixpanel-plugin

Official Mixpanel analytics plugin for OnboardJS. This plugin provides comprehensive tracking and analytics for your onboarding flows using Mixpanel.

## Features

- 🔄 **Comprehensive Event Tracking**: Track all onboarding events including flow start/completion, step transitions, user interactions, and more
- 📊 **User Analytics**: Automatic user property tracking and identification
- 🎯 **Churn Detection**: Built-in churn risk detection with configurable thresholds
- ⚡ **Performance Monitoring**: Track step render times and identify performance bottlenecks
- 🧪 **A/B Testing Support**: Track experiment exposures and variants
- 🔒 **Privacy Compliant**: Built-in data sanitization and PII exclusion options
- 📈 **Progress Milestones**: Track user progress through configurable milestones
- 🛠 **Highly Configurable**: Extensive configuration options for custom tracking needs

## Installation

```bash
npm install @onboardjs/mixpanel-plugin mixpanel-browser
```

## Quick Start

```typescript
import { createMixpanelPlugin } from '@onboardjs/mixpanel-plugin';
import { OnboardingEngine } from '@onboardjs/core';

const mixpanelPlugin = createMixpanelPlugin({
  token: 'your-mixpanel-token',
  eventPrefix: 'onboarding_',
  includeUserProperties: true,
  enableChurnDetection: true,
});

const engine = new OnboardingEngine({
  plugins: [mixpanelPlugin],
  // ... other config
});
```

## Configuration

### Basic Configuration

```typescript
const mixpanelPlugin = createMixpanelPlugin({
  // Required: Your Mixpanel project token
  token: 'your-mixpanel-token',
  
  // Optional: Mixpanel configuration
  config: {
    debug: true,
    persistence: 'localStorage',
  },
  
  // Optional: Use existing Mixpanel instance
  mixpanelInstance: existingMixpanelInstance,
  
  // Event naming
  eventPrefix: 'onboarding_',
  customEventNames: {
    flowStarted: 'flow_begin',
    flowCompleted: 'flow_finish',
  },
  
  // Data inclusion options
  includeUserProperties: true,
  includeFlowData: true,
  includeStepMetadata: true,
  includeSessionData: true,
});
```

### Privacy and Compliance

```typescript
const mixpanelPlugin = createMixpanelPlugin({
  token: 'your-token',
  
  // Exclude personal data
  excludePersonalData: true,
  
  // Exclude specific flow data keys
  excludeFlowDataKeys: ['sensitiveField', 'privateData'],
  
  // Custom data sanitization
  sanitizeData: (data) => {
    // Your custom sanitization logic
    return sanitizedData;
  },
});
```

### Churn Detection

```typescript
const mixpanelPlugin = createMixpanelPlugin({
  token: 'your-token',
  
  // Enable churn detection
  enableChurnDetection: true,
  churnTimeoutMs: 300000, // 5 minutes
  churnRiskThreshold: 0.7, // 70% risk threshold
});
```

### Performance Monitoring

```typescript
const mixpanelPlugin = createMixpanelPlugin({
  token: 'your-token',
  
  // Enable performance tracking
  enablePerformanceTracking: true,
  performanceThresholds: {
    slowStepMs: 2000, // Track steps taking longer than 2s
    slowRenderMs: 1000, // Track renders taking longer than 1s
  },
});
```

## Configuration Presets

### SaaS Applications

```typescript
import { saasConfig, createMixpanelPlugin } from '@onboardjs/mixpanel-plugin';

const mixpanelPlugin = createMixpanelPlugin({
  ...saasConfig,
  token: 'your-token',
});
```

### E-commerce

```typescript
import { ecommerceConfig, createMixpanelPlugin } from '@onboardjs/mixpanel-plugin';

const mixpanelPlugin = createMixpanelPlugin({
  ...ecommerceConfig,
  token: 'your-token',
});
```

## Tracked Events

The plugin automatically tracks the following events:

### Flow Events
- `flow_started` - When an onboarding flow begins
- `flow_completed` - When a flow is completed
- `flow_abandoned` - When a user abandons the flow
- `flow_paused` / `flow_resumed` - Flow state changes
- `flow_reset` - When a flow is reset

### Step Events
- `step_active` - When a step becomes active
- `step_completed` - When a step is completed
- `step_skipped` - When a step is skipped
- `step_retried` - When a step is retried
- `step_validation_failed` - When step validation fails
- `step_help_requested` - When user requests help

### Navigation Events
- `navigation_back` / `navigation_forward` - Navigation actions
- `navigation_jump` - When user jumps to a specific step

### Progress Events
- `progress_milestone` - When user reaches progress milestones
- `high_churn_risk` - When churn risk is detected

### Performance Events
- `step_render_slow` - When step rendering is slow
- `persistence_success` / `persistence_failure` - Data persistence events

## Advanced Usage

### Custom Event Properties

```typescript
const mixpanelPlugin = createMixpanelPlugin({
  token: 'your-token',
  
  // Global properties added to all events
  globalProperties: {
    product: 'my-app',
    version: '1.0.0',
  },
  
  // Step-specific property enrichers
  stepPropertyEnrichers: {
    FORM: (step, context) => ({
      form_fields_count: step.payload.fields?.length || 0,
      form_complexity: calculateComplexity(step.payload),
    }),
  },
  
  // Custom user property mapping
  userPropertyMapper: (user) => ({
    $email: user.email,
    $name: user.name,
    signup_date: user.createdAt,
    plan: user.subscription?.plan,
  }),
});
```

### Event Filtering

```typescript
const mixpanelPlugin = createMixpanelPlugin({
  token: 'your-token',
  
  // Only track specific events
  includeOnlyEvents: ['flowStarted', 'flowCompleted', 'stepCompleted'],
  
  // Exclude specific events
  excludeEvents: ['dataChanged', 'persistenceSuccess'],
  
  // Filter by step types
  stepTypeFilters: ['FORM', 'CHECKLIST'],
});
```

## TypeScript Support

The plugin is fully typed and supports generic context types:

```typescript
interface MyOnboardingContext extends OnboardingContext {
  userProfile: UserProfile;
  preferences: UserPreferences;
}

const mixpanelPlugin = createMixpanelPlugin<MyOnboardingContext>({
  token: 'your-token',
  // Full type safety for your context
});
```

## License

MIT

## Contributing

See the main OnboardJS repository for contribution guidelines.
