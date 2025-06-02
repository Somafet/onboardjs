import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import OnboardingProviderWrapper from "@/components/onboarding/OnboardingProviderWrapper";

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
        <OnboardingProviderWrapper>{children}</OnboardingProviderWrapper>
        <Toaster />
      </body>
    </html>
  );
}
