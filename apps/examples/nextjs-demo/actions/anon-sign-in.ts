'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export const signinAnonymously = async () => {
    const supabase = await createClient()

    const {
        error,
        data: { user },
    } = await supabase.auth.signInAnonymously()

    if (error) {
        console.error('Error signing in anonymously:', error)
        return
    }

    console.log('Signed in anonymously successfully', user?.id)

    revalidatePath('/')
}
