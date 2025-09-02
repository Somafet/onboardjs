import type { Metadata } from 'next'
import { Lexend } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import OnboardingProviderWrapper from '@/components/onboarding/OnboardingProviderWrapper'
import { createClient } from '@/lib/supabase-server'
import { PostHogProvider } from '@/components/posthog/PostHogProvider'

const lexend = Lexend({
    variable: '--font-lexend',
    subsets: ['latin'],
})

export const metadata: Metadata = {
    title: 'OnboardJs Next.js Demo',
    description: 'OnboardJs Next.js Demo - Build Custom Onboarding Flows',
}

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    const client = await createClient()
    const {
        data: { user },
    } = await client.auth.getUser()

    return (
        <html lang="en">
            <body className={`${lexend.variable} antialiased font-lexend`}>
                <PostHogProvider>
                    <OnboardingProviderWrapper user={user}>{children}</OnboardingProviderWrapper>
                </PostHogProvider>
                <Toaster />
            </body>
        </html>
    )
}
