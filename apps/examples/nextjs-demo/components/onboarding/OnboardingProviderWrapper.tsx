"use client";

import {
  demoOnboardingSteps,
  demoStepComponentRegistry,
} from "@/config/onboardingConfig";
import { createClient } from "@/lib/supabase";
import { OnboardingProvider } from "@onboardjs/react";
import { createSupabasePlugin } from "@onboardjs/supabase-plugin";

export default function OnboardingProviderWrapper({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const client = createClient();

  const supabasePlugin = createSupabasePlugin({
    client,
    tableName: "onboarding_progress",
    contextKeyForId: "currentUser.id",
    onError(error, operation) {
      console.error(
        `[SupabasePlugin] Error during ${operation}:`,
        error.message,
      );
    },
    stateDataColumn: "flow_data",
    userIdColumn: "user_id",
  });
  return (
    <OnboardingProvider
      initialContext={{
        // You can provide your actual user here. This is just the demo user.
        currentUser: {
          id: "a84d94de-2d2e-4861-a956-60d17393cf78",
          app_metadata: {
            provider: "supabase",
          },
          user_metadata: {},
          created_at: "2023-10-01T12:00:00Z",
          aud: "authenticated",
        },
      }}
      steps={demoOnboardingSteps}
      plugins={[supabasePlugin]}
      componentRegistry={demoStepComponentRegistry}
    >
      {children}
    </OnboardingProvider>
  );
}
