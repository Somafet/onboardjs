# OnboardJS Supabase Persistence Plugin

[![npm version](https://img.shields.io/npm/v/@onboardjs/supabase-plugin.svg)](https://www.npmjs.com/package/@onboardjs/supabase-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OnboardJS Core](https://img.shields.io/badge/requires-%40onboardjs%2Fcore-blue)](https://www.npmjs.com/package/@onboardjs/core)

Official plugin for `@onboardjs/core` to seamlessly persist user onboarding state to your Supabase database.

This plugin handles loading, saving, and clearing a user's progress, allowing them to continue their onboarding flow across different sessions and devices.

## Features

- **Seamless Persistence**: Automatically saves and loads onboarding progress.
- **Automatic User Identification**: Can automatically use the authenticated Supabase user's ID, requiring zero configuration.
- **Flexible Manual Mode**: Allows for explicit user identification via the Onboarding Context for more complex use cases.
- **Customizable**: Configure table and column names to match your existing database schema.
- **Robust Error Handling**: Provides an `onError` callback to gracefully handle any database persistence failures.
- **Fully Typed**: Written in TypeScript for a great developer experience.

## 1. Database Setup

Before using the plugin, you need a table in your Supabase database to store the state. You can create it by running the following snippet in the Supabase SQL Editor.

This schema includes recommended Row Level Security (RLS) policies to ensure users can only access their own onboarding state.

```sql
-- 1. Create the table to store onboarding state
CREATE TABLE public.onboarding_state (
  id UUID NOT NULL,
  state_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  constraint onboarding_state_pkey primary key (id),
  constraint onboarding_state_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
);

-- 2. Enable Row Level Security (Highly Recommended)
ALTER TABLE public.onboarding_state ENABLE ROW LEVEL SECURITY;

-- 3. Create a policy that allows users to manage their own state
CREATE POLICY "Users can manage their own onboarding state"
ON public.onboarding_state
FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

## 2. Installation

Install the plugin alongside its peer dependencies.

```bash
npm install @onboardjs/core @onboardjs/supabase-plugin @supabase/supabase-js
```

## 3. Usage

Instantiate the plugin with your Supabase client and add it to the `plugins` array in the `OnboardingEngine` or `@onboardjs/react`'s `OnboardingProvider`.

The plugin can be configured in two ways:

### Mode 1: Automatic User Detection (Recommended)

If your users are authenticated via Supabase Auth, this is the simplest method. The plugin will automatically get the user's ID and make the Supabase `User` object available in the context at `context.currentUser`.

```tsx
// Example with @onboardjs/react
import { OnboardingProvider } from '@onboardjs/react'
import { SupabasePersistencePlugin } from '@onboardjs/supabase-plugin'
import { createClient } from '@supabase/supabase-js'

// 1. Initialize your Supabase client
const supabase = createClient('YOUR_URL', 'YOUR_ANON_KEY')

// 2. Create an instance of the plugin
const supabasePlugin = createSupabasePlugin({
    client,
    tableName: 'onboarding_state',
    contextKeyForId: 'currentUser.id',
    onError(error, operation) {
        console.error(`[SupabasePlugin] Error during ${operation}:`, error.message)
    },
    stateDataColumn: 'flow_data',
    userIdColumn: 'user_id',
})

function App() {
    return (
        <OnboardingProvider steps={mySteps} plugins={[supabasePlugin]} componentRegistry={myComponentRegistry}>
            {/* Your app content */}
        </OnboardingProvider>
    )
}
```

### Mode 2: Manual Context ID

If you store your user ID elsewhere or want to be more explicit, you can provide a path to the ID within the `OnboardingContext`.

```tsx
import { SupabasePersistencePlugin } from '@onboardjs/supabase-plugin'

const supabasePlugin = new SupabasePersistencePlugin({
    client: supabase,
    // Tell the plugin where to find the user's ID in the context
    contextKeyForId: 'currentUser.id',
})

// You must provide an initialContext that matches the key structure
const initialContext = {
    currentUser: {
        id: 'user-12345', // This would typically come from your auth state
    },
}

function App() {
    return (
        <OnboardingProvider
            steps={mySteps}
            plugins={[supabasePlugin]}
            initialContext={initialContext}
            componentRegistry={myComponentRegistry}
        >
            {/* Your app content */}
        </OnboardingProvider>
    )
}
```

## 4. Configuration Options

The plugin accepts the following configuration options:

| Option          | Type                                               | Required      | Default            | Description                                                                                                 |
| --------------- | -------------------------------------------------- | ------------- | ------------------ | ----------------------------------------------------------------------------------------------------------- |
| client          | SupabaseClient                                     | Yes           | -                  | Your initialized Supabase client instance.                                                                  |
| useSupabaseAuth | boolean                                            | No            | false              | If true, automatically uses the authenticated Supabase user's ID.                                           |
| contextKeyForId | string                                             | Conditionally | -                  | Dot-notation path to the unique user ID within the OnboardingContext. Required if useSupabaseAuth is false. |
| tableName       | string                                             | No            | 'onboarding_state' | The name of the table in your database.                                                                     |
| userIdColumn    | string                                             | No            | 'id'               | The name of the user ID column in your table.                                                               |
| stateDataColumn | string                                             | No            | 'state_data'       | The name of the JSONB column where the onboarding state will be stored.                                     |
| onError         | (error: PostgrestError, operation: string) => void | No            | -                  | Optional callback to handle persistence errors for load, persist, or clear operations.                      |

## 5. Error Handling

The plugin catches errors from Supabase operations and reports them to the OnboardJS engine. You can also provide a custom `onError` callback for more granular control, such as logging to a monitoring service.

```tsx
const supabasePlugin = new SupabasePersistencePlugin({
    client: supabase,
    useSupabaseAuth: true,
    onError: (error, operation) => {
        console.error(`Supabase operation '${operation}' failed!`, error)
        // Example: send to a logging service
        // Sentry.captureException(error, { extra: { operation } });
    },
})
```

## License

This plugin is licensed under the [MIT License](https://opensource.org/licenses/MIT). Feel free to use, modify, and distribute it in your projects.
