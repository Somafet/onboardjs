// app/onboarding/page.tsx
import { OnboardingClientWrapper } from "@/components/onboarding/OnboardingClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Complete Your Setup",
  description: "Follow these steps to get started with our application.",
};

export default function OnboardingPage() {
  return (
    <main className="container mx-auto py-10 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8">Application Onboarding</h1>
      <OnboardingClientWrapper />
    </main>
  );
}
