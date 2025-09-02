'use client'
import { StepComponentProps } from '@onboardjs/react'
import React from 'react'
import { RefreshCwIcon } from 'lucide-react'
import { AppOnboardingContext } from '../common-flow-config'
import SupabaseLogo from '@/components/supabase-logo'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { signinAnonymously } from '@/actions/anon-sign-in'

const PersistenceWithSupabaseStep: React.FC<StepComponentProps<unknown, AppOnboardingContext>> = ({ coreContext }) => {
    const user = coreContext.currentUser

    return (
        <div className="space-y-8 animate-fade-left">
            <div className="flex items-center gap-3 justify-center">
                <Link href="https://supabase.com" target="_blank">
                    <SupabaseLogo height={50} width={'auto'} />
                </Link>
            </div>

            {!user ? (
                <>
                    <p>
                        <span className="font-bold">Welcome to the Persistence Step!</span> This step demonstrates how
                        to persist your onboarding progress using Supabase.
                    </p>
                    <p>
                        To test out the persistence feature, you can sign in anonymously. This will create a user
                        session that allows you to save your progress in the onboarding flow. Once signed in, you can
                        refresh the page, and your progress will be saved in the database.
                    </p>
                    <Button onClick={signinAnonymously}>Sign in Anonymously</Button>
                </>
            ) : (
                <div className="space-y-6">
                    <p>
                        <span className="font-bold">Good news!</span> This onboarding flow is already being{' '}
                        <span className="font-semibold">persisted to the database</span> using Supabase.
                    </p>
                    <div className="flex items-center gap-2">
                        <RefreshCwIcon className="size-5 " />
                        <span>Try refreshing the page—your progress will still be here!</span>
                    </div>
                </div>
            )}
        </div>
    )
}

export default PersistenceWithSupabaseStep
