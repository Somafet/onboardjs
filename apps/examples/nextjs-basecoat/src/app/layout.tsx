import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OnboardingProvider } from "@onboardjs/react";
import { steps } from "../lib/onboarding/onboarding-steps";

import "./globals.css";
import { componentRegistry } from "../lib/onboarding/onboarding-registry";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OnboardJS + Basecoat Next.js Example",
  description: "Using OnboardJS with Basecoat in Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <OnboardingProvider
          steps={steps}
          componentRegistry={componentRegistry}
          localStoragePersistence={{ key: "onboarding-example" }}
        >
          {children}
        </OnboardingProvider>
      </body>
    </html>
  );
}
