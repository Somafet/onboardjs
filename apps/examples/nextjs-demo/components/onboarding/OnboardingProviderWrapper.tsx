"use client";

import { demoOnboardingSteps } from "@/config/onboardingConfig";
import { createSupabasePlugin } from "@/lib/supabase-plugin";
import { OnboardingProvider } from "@onboardjs/react";

export default function OnboardingProviderWrapper({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseProvider = createSupabasePlugin({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    tableName: "onboarding_progress",
    userIdField: "user_id",
  });
  return (
    <OnboardingProvider
      steps={demoOnboardingSteps}
      // Enable localStorage persistence for this demo
      plugins={[supabaseProvider]}
    >
      {children}
    </OnboardingProvider>
  );
}
