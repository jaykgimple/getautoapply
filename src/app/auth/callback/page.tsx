'use client'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [status, setStatus] = useState('Processing login...')
  const [linkedinProfile, setLinkedinProfile] = useState<any>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Wait a moment for the session to be established from the URL hash
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Get the session after OAuth redirect
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
        }
        
        if (!session?.user) {
          // Try one more time after a longer delay
          await new Promise(resolve => setTimeout(resolve, 2000))
          const { data: { session: retrySession } } = await supabase.auth.getSession()
          
          if (!retrySession?.user) {
            console.error('No session after retry')
            setStatus('Authentication failed. Redirecting to login...')
            setTimeout(() => router.push('/login'), 2000)
            return
          }
          
          return handleSessionUser(retrySession)
        }
        
        return handleSessionUser(session)
      } catch (err: any) {
        console.error('Auth callback error:', err)
        setStatus('Error. Redirecting...')
        setTimeout(() => router.push('/settings'), 2000)
      }
    }

    const handleSessionUser = async (session: any) => {
      const user = session.user
      
      // Check if this is a LinkedIn-linked identity
      const linkedinIdentity = user.identities?.find(
        (i: any) => i.provider === 'linkedin' || i.provider === 'linkedin_oidc'
      )

      if (linkedinIdentity) {
        const identityData = linkedinIdentity.identity_data || {}
        const firstName = identityData?.given_name || identityData?.firstName || ''
        const lastName = identityData?.family_name || identityData?.lastName || ''
        const name = `${firstName} ${lastName}`.trim() || 'LinkedIn User'
        
        setLinkedinProfile({
          name,
          headline: identityData?.headline || '',
          imageUrl: identityData?.picture || identityData?.profile_image_url || '',
        })

        // Save LinkedIn profile data to profiles table
        const { error: upsertError } = await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          linkedin_connected: true,
          linkedin_id: identityData?.sub || identityData?.id || linkedinIdentity.id,
          linkedin_first_name: firstName,
          linkedin_last_name: lastName,
          linkedin_headline: identityData?.headline || '',
          linkedin_summary: identityData?.summary || '',
          linkedin_profile_url: identityData?.vanityName 
            ? `https://www.linkedin.com/in/${identityData.vanityName}` 
            : identityData?.sub ? `https://www.linkedin.com/in/${identityData.sub}` : '',
          linkedin_profile_image_url: identityData?.picture || identityData?.profile_image_url || '',
          linkedin_raw_profile: identityData,
          linkedin_connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })

        if (upsertError) {
          console.error('Profile upsert error:', upsertError)
        }

        setStatus('LinkedIn connected! Redirecting...')
      } else {
        setStatus('Connected! Redirecting...')
      }

      // Check for error params from LinkedIn/OAuth
      const errorParam = searchParams?.get('error')
      const errorDesc = searchParams?.get('error_description')
      if (errorParam) {
        console.error('OAuth error:', errorParam, errorDesc)
        setStatus(`Login error: ${errorDesc || errorParam}. Redirecting...`)
        setTimeout(() => router.push('/settings'), 3000)
        return
      }

      // Redirect back to the page the user came from
      const returnTo = sessionStorage.getItem('linkedin_connect_return_to') || '/settings'
      sessionStorage.removeItem('linkedin_connect_return_to')
      
      setTimeout(() => {
        router.push(returnTo + (returnTo.includes('?') ? '&' : '?') + 'linkedin_linked=true')
      }, 1500)
    }

    handleCallback()
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="text-center max-w-sm">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
        <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>{status}</p>
        
        {linkedinProfile && (
          <div className="mt-6 p-4 rounded-lg border" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              {linkedinProfile.imageUrl ? (
                <img src={linkedinProfile.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-medium" style={{ background: '#0A66C2' }}>
                  {linkedinProfile.name.charAt(0) || 'L'}
                </div>
              )}
              <div className="text-left">
                <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{linkedinProfile.name}</p>
                {linkedinProfile.headline && (
                  <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{linkedinProfile.headline}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
          <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>Processing login...</p>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}
