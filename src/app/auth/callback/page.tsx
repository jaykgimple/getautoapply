'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthCallback() {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState('Processing...')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session after OAuth redirect
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session?.user) {
          setStatus('Authentication failed. Redirecting...')
          setTimeout(() => router.push('/login'), 2000)
          return
        }

        const user = session.user

        // Check if LinkedIn identity is linked
        const linkedinIdentity = user.identities?.find(
          i => i.provider === 'linkedin' || i.provider === 'linkedin_oidc'
        )

        if (linkedinIdentity) {
          const identityData = linkedinIdentity.identity_data as any
          
          // Save LinkedIn profile data to profiles table
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            linkedin_connected: true,
            linkedin_id: identityData?.sub || identityData?.id || linkedinIdentity.id,
            linkedin_first_name: identityData?.given_name || identityData?.firstName || '',
            linkedin_last_name: identityData?.family_name || identityData?.lastName || '',
            linkedin_headline: identityData?.headline || '',
            linkedin_summary: identityData?.summary || '',
            linkedin_profile_url: identityData?.vanityName 
              ? `https://www.linkedin.com/in/${identityData.vanityName}` 
              : `https://www.linkedin.com/in/${identityData?.sub || ''}`,
            linkedin_profile_image_url: identityData?.picture || identityData?.profile_image_url || '',
            linkedin_raw_profile: identityData,
            linkedin_connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })

          setStatus('LinkedIn connected! Redirecting...')
        }

        // Redirect back to the page the user came from
        const returnTo = sessionStorage.getItem('linkedin_connect_return_to') || '/settings'
        sessionStorage.removeItem('linkedin_connect_return_to')
        
        setTimeout(() => {
          router.push(returnTo + (returnTo.includes('?') ? '&' : '?') + 'linkedin_linked=true')
        }, 1000)
      } catch (err: any) {
        console.error('Auth callback error:', err)
        setStatus('Error. Redirecting...')
        setTimeout(() => router.push('/settings'), 2000)
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
        <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>{status}</p>
      </div>
    </div>
  )
}
