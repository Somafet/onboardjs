import type { Metadata } from "next";
import { Lexend, Overpass_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { OnboardingProvider } from "@onboardjs/react";
import { demoOnboardingSteps } from "@/config/onboardingConfig";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OnboardJs Next.js Demo",
  description: "OnboardJs Next.js Demo - Build Custom Onboarding Flows",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${lexend.variable} antialiased font-lexend`}>
        <OnboardingProvider
          steps={demoOnboardingSteps}
          // Enable localStorage persistence for this demo
          localStoragePersistence={{
            key: "onboardjsDemo_v1_progress",
            ttl: 1000 * 60 * 60 * 24,
          }}
          // Use the custom persistence handlers to implement your own logic
          // customOnDataLoad={() => { return fetch('/api/load-onboarding-data') }} // Load data from your API or Db
          // customOnDataPersist={} // Persist data to your API or Db
          // customOnClearPeristedData={} // Handle clearing the persisted data (e.g., on onboarding flow reset)
        >
          {children}
        </OnboardingProvider>
        <Toaster />
      </body>
    </html>
  );
}
