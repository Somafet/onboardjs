# OnboardJS Next.js Demo

A comprehensive Next.js example demonstrating the **OnboardJS** headless onboarding engine with role-based flow branching, Supabase persistence, and PostHog analytics integration.

## Overview

This demo showcases:

- **Dynamic onboarding flows** with conditional step routing based on user role
- **Supabase integration** for persisting onboarding progress
- **PostHog analytics** tracking for onboarding funnel analysis
- **React Context & Hooks** for seamless state management
- **Custom UI components** with ShadCN UI and Tailwind CSS
- **Next.js App Router** with server-side authentication

## Prerequisites

- Node.js 18+ and pnpm
- A [Supabase](https://supabase.com) account and project
- A [PostHog](https://posthog.com) account (optional, for analytics)

## Setup

### 1. Install Dependencies

From the root of the monorepo:

```bash
pnpm install
```

### 2. Configure Supabase

This is a basic setup for persisting onboarding progress in a separate table. You may integrate this concept into your existing schema as needed.

#### Create the `onboarding_progress` Table

1. In your Supabase project, navigate to the **SQL Editor**
2. Run the following SQL to create the table:

```sql
CREATE TABLE onboarding_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Enable Row-Level Security (RLS)

1. Navigate to **Authentication** → **Policies** in your Supabase dashboard
2. Select the `onboarding_progress` table
3. Enable RLS and add the following policies with target role `authenticated`:

**SELECT Policy** (Read access):

```sql
using (
  (( SELECT auth.uid() AS uid) = user_id)
);
```

**INSERT Policy** (Create access):

```sql
with check (
  (( SELECT auth.uid() AS uid) = user_id)
);
```

**UPDATE Policy** (Update access):

```sql
with check (
  (( SELECT auth.uid() AS uid) = user_id)
);
```

These policies ensure users can only read, insert, and update their own onboarding progress.

### 3. Environment Variables

Create a `.env.local` file in this directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_URL.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# PostHog (optional)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

Get these values from your Supabase project settings:

- **Project URL**: Settings → General → Project URL
- **Anon Key**: Settings → API → Project API keys → `anon` / `public`

## Running the Demo

### Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The onboarding flow will start automatically. Sign in with Supabase auth, and your progress will be saved to the `onboarding_progress` table.

### Production Build

```bash
pnpm build
pnpm start
```

## Key Features

### Dynamic Flow Routing

The `common-flow-config.ts` defines conditional routing based on `flowData.userRole`:

```typescript
nextStep: (context) => {
    if (context.flowData?.userRole === 'developer') {
        return 'dev-setup'
    }
    return 'business-setup'
}
```

### Supabase Persistence

Onboarding progress is automatically persisted using the `@onboardjs/supabase-plugin`:

```typescript
import { createSupabasePlugin } from '@onboardjs/supabase-plugin'

const supabasePlugin = createSupabasePlugin<AppOnboardingContext>({
    client,
    tableName: 'onboarding_progress',
    contextKeyForId: 'currentUser.id',
    onError(error, operation) {
        console.error(`[SupabasePlugin] Error during ${operation}:`, error.message)
    },
    stateDataColumn: 'flow_data',
    userIdColumn: 'user_id',
})
```

## Learn More

- [OnboardJS Documentation](https://docs.onboardjs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [PostHog Documentation](https://posthog.com/docs)

## Support

For issues or questions about OnboardJS:

- Visit the [OnboardJS Discord](https://discord.onboardjs.com)
