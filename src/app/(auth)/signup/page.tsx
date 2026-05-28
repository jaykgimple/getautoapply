'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push('/dashboard')
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg-base)' }}>
        <div className="w-full max-w-sm text-center">
          <h1 className="text-[20px] font-medium" style={{ color: 'var(--text-primary)' }}>Check your email</h1>
          <p className="text-[14px] mt-2" style={{ color: 'var(--text-tertiary)' }}>We sent a confirmation link to {email}</p>
          <Link href="/login" className="inline-block mt-6 text-[14px] font-medium hover:underline" style={{ color: 'var(--brand-bright)' }}>Back to login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-sm" style={{ background: 'var(--brand)' }}>JB</div>
          </Link>
          <h1 className="text-[20px] font-medium" style={{ color: 'var(--text-primary)' }}>Create your account</h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>Start your AI-powered job search</p>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {error && <p className="text-[13px] p-2 rounded-lg" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
          <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <input type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <button type="submit" disabled={loading} className="w-full text-[14px] font-medium py-2.5 rounded-lg text-white hover:opacity-90 disabled:opacity-50" style={{ background: 'var(--brand)' }}>{loading ? 'Creating account...' : 'Create account'}</button>
        </form>

        <p className="text-center text-[13px] mt-6" style={{ color: 'var(--text-tertiary)' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--brand-bright)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
