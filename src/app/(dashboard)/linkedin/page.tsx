'use client'

import { useState, useEffect } from 'react'

const SECTIONS = [
  { key: 'headline', label: 'Headline', placeholder: 'e.g. Senior Software Engineer | React | Node.js | Building scalable web apps', hint: 'Found at the top of your LinkedIn profile, below your name' },
  { key: 'about', label: 'About / Summary', placeholder: 'Paste your LinkedIn About section here...', hint: 'Click "Show more" in your About section to see the full text' },
  { key: 'experience', label: 'Experience', placeholder: 'Paste your job titles, companies, and descriptions...', hint: 'Include job title, company name, dates, and bullet points for each role' },
  { key: 'skills', label: 'Skills', placeholder: 'List your skills (comma-separated or one per line)...', hint: 'Found in the Skills section of your profile' },
]

const COPY_STEPS = [
  { label: 'Headline', instruction: 'Go to your LinkedIn profile. Copy the headline text below your name (your job title and specialties).' },
  { label: 'About', instruction: 'Scroll to your "About" section. Click "Show more" if available, then copy the entire text.' },
  { label: 'Experience', instruction: 'Scroll to "Experience". For each role, copy the job title, company, dates, and description bullets.' },
  { label: 'Skills', instruction: 'Scroll to "Skills". Copy your listed skills (top 10-15 is sufficient).' },
]

type LinkedInStatus = 'checking' | 'connected' | 'disconnected' | 'expired' | 'error'

export default function LinkedInAnalyzer() {
  const [mode, setMode] = useState<'url' | 'paste'>('url')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [sections, setSections] = useState<Record<string, string>>({
    headline: '',
    about: '',
    experience: '',
    skills: '',
  })
  const [linkedinStatus, setLinkedinStatus] = useState<LinkedInStatus>('checking')
  const [linkedinConnecting, setLinkedinConnecting] = useState(false)
  const [linkedinError, setLinkedinError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [urlSaved, setUrlSaved] = useState(false)

  // Check LinkedIn connection status on mount + after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('linkedin_connected') === 'true') {
      setLinkedinStatus('connected')
      setLinkedinError('')
      window.history.replaceState({}, '', '/linkedin')
      return
    }
    if (params.get('linkedin_error')) {
      setLinkedinStatus('error')
      setLinkedinError(decodeURIComponent(params.get('linkedin_error') || ''))
      window.history.replaceState({}, '', '/linkedin')
      return
    }

    // Check stored connection
    fetch('/api/ai/linkedin/fetch')
      .then(res => {
        if (res.ok) setLinkedinStatus('connected')
        else setLinkedinStatus('disconnected')
      })
      .catch(() => setLinkedinStatus('disconnected'))

    // Listen for popup close — poll for connection status
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/ai/linkedin/fetch')
        if (res.ok) {
          setLinkedinStatus('connected')
          setLinkedinError('')
          clearInterval(interval)
        }
      } catch { /* not connected yet */ }
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const updateSection = (key: string, value: string) => {
    setSections(prev => ({ ...prev, [key]: value }))
  }

  // ─── OAuth: Sign in with LinkedIn ───
  const handleConnectLinkedIn = async () => {
    setLinkedinConnecting(true)
    setLinkedinError('')
    try {
      const res = await fetch('/api/auth/linkedin', { method: 'POST' })
      const data = await res.json()
      if (data.authUrl) {
        // Open LinkedIn OAuth in a popup
        const width = 520, height = 600
        const left = (window.innerWidth - width) / 2
        const top = (window.innerHeight - height) / 2
        window.open(data.authUrl, 'linkedin_oauth', `width=${width},height=${height},top=${top},left=${left}`)
      } else {
        setLinkedinError(data.error || 'Could not initiate LinkedIn sign-in')
      }
    } catch (err: any) {
      setLinkedinError(err.message)
    } finally {
      setLinkedinConnecting(false)
    }
  }

  // ─── OAuth: Load profile after connection ───
  const handleLoadFromLinkedIn = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/linkedin/fetch')
      const data = await res.json()
      if (!res.ok) {
        if (data.expired) setLinkedinStatus('expired')
        throw new Error(data.error || 'Failed to load profile')
      }
      if (data.connected && data.profile) {
        const p = data.profile
        setSections({
          headline: p.headline || '',
          about: p.summary || '',
          experience: (p.experience || []).join('\n\n'),
          skills: (p.skills || []).join(', '),
        })
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ─── Manual URL paste flow ───
  const handleSaveUrl = () => {
    if (!linkedinUrl.trim()) { setError('Please enter your LinkedIn profile URL.'); return }
    if (!linkedinUrl.includes('linkedin.com/in/')) { setError('Please enter a valid URL (e.g. https://www.linkedin.com/in/yourname)'); return }
    setUrlSaved(true)
    setError('')
  }

  const filledCount = Object.values(sections).filter(v => v.trim()).length

  // ─── Analyze ───
  const handleAnalyze = async () => {
    const profileText = Object.entries(sections)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `${k.toUpperCase()}:\n${v.trim()}`)
      .join('\n\n')

    if (profileText.length < 50) {
      setError('Please fill in at least one section.')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/ai/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileText }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Analysis failed')
      }
      const data = await res.json()
      setResult(data.analysis)
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const gradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'var(--success)'
    if (grade.startsWith('B')) return 'var(--brand)'
    if (grade.startsWith('C')) return 'var(--warning)'
    return 'var(--danger)'
  }

  const scoreColor = (score: number) => {
    if (score >= 80) return 'var(--success)'
    if (score >= 60) return 'var(--brand)'
    if (score >= 40) return 'var(--warning)'
    return 'var(--danger)'
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-[24px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>LinkedIn Profile Analyzer</h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            AI scores your profile against recruiter expectations and recommends improvements.
          </p>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setMode('url'); setError(''); setResult(null) }}
            className="text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
            style={{
              background: mode === 'url' ? 'var(--brand)' : 'var(--bg-surface)',
              color: mode === 'url' ? '#fff' : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: mode === 'url' ? 'var(--brand)' : 'var(--border-subtle)',
            }}
          >
            Option 1: Connect LinkedIn
          </button>
          <button
            onClick={() => { setMode('paste'); setError(''); setResult(null) }}
            className="text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
            style={{
              background: mode === 'paste' ? 'var(--brand)' : 'var(--bg-surface)',
              color: mode === 'paste' ? '#fff' : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: mode === 'paste' ? 'var(--brand)' : 'var(--border-subtle)',
            }}
          >
            Option 2: Paste Info Manually
          </button>
        </div>

        {/* ─── Option 1: LinkedIn OAuth ─── */}
        {mode === 'url' && (
          <div className="space-y-5">
            {/* Connection status / button */}
            <div className="rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              <h3 className="text-[14px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Step 1: Connect your LinkedIn</h3>

              {linkedinStatus === 'checking' && (
                <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>Checking connection status...</p>
              )}

              {(linkedinStatus === 'disconnected' || linkedinStatus === 'expired' || linkedinStatus === 'error') && (
                <>
                  {linkedinStatus === 'expired' && (
                    <p className="text-[13px] mb-3 p-2 rounded" style={{ color: 'var(--warning)', background: 'rgba(234,179,8,0.1)' }}>
                      Your LinkedIn connection has expired. Please reconnect.
                    </p>
                  )}
                  {linkedinError && (
                    <p className="text-[13px] mb-3 p-2 rounded" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>
                      {linkedinError}
                    </p>
                  )}
                  <button
                    onClick={handleConnectLinkedIn}
                    disabled={linkedinConnecting}
                    className="inline-flex items-center gap-2 text-[13px] font-medium px-5 py-2.5 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#0A66C2' }}
                  >
                    {/* LinkedIn "in" logo */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    {linkedinConnecting ? 'Connecting...' : 'Sign in with LinkedIn'}
                  </button>
                  <p className="text-[11px] mt-2" style={{ color: 'var(--text-quaternary)' }}>
                    We use LinkedIn OAuth to fetch your profile data securely. We cannot see your password.
                  </p>
                </>
              )}

              {linkedinStatus === 'connected' && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success)' }}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[12px] font-medium">Connected</span>
                  </div>
                  <button
                    onClick={handleConnectLinkedIn}
                    className="text-[12px] underline"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Reconnect
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Load profile (only when connected) */}
            {linkedinStatus === 'connected' && (
              <div className="rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-[14px] font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Step 2: Load your profile
                </h3>
                <p className="text-[12px] mb-3" style={{ color: 'var(--text-tertiary)' }}>
                  We&apos;ll pull your headline, summary, experience, and skills from LinkedIn. You can review and edit before analyzing.
                </p>
                <button
                  onClick={handleLoadFromLinkedIn}
                  disabled={loading}
                  className="text-[13px] font-medium px-5 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--brand)' }}
                >
                  {loading ? 'Loading...' : 'Load Profile from LinkedIn'}
                </button>
              </div>
            )}

            {/* Fallback: manual URL paste */}
            <details className="rounded-lg border" style={{ background: 'var(--bg-panel)', borderColor: 'var(' }}>
              <summary className="text-[13px] font-medium px-5 py-3 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                Or paste your profile URL and copy manually
              </summary>
              <div className="px-5 pb-4 space-y-3">
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={e => { setLinkedinUrl(e.target.value); setUrlSaved(false) }}
                  placeholder="https://www.linkedin.com/in/your-name"
                  className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <button onClick={handleSaveUrl} className="text-[12px] font-medium px-4 py-1.5 rounded text-white" style={{ background: 'var(--brand)' }}>
                  Set URL
                </button>

                {urlSaved && (
                  <div className="mt-2">
                    <p className="text-[12px] mb-2" style={{ color: 'var(--text-tertiary)' }}>
                      <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium" style={{ color: 'var(--brand)' }}>
                        Open your LinkedIn profile →
                      </a>
                      {' '}Copy each section and paste below.
                    </p>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {COPY_STEPS.map((step, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentStep(i)}
                          className="text-[11px] font-medium px-3 py-1.5 rounded-full transition-colors"
                          style={{
                            background: currentStep === i ? 'var(--brand)' : sections[SECTIONS[i].key].trim() ? 'rgba(34,197,94,0.15)' : 'var(--bg-surface)',
                            color: currentStep === i ? '#fff' : sections[SECTIONS[i].key].trim() ? 'var(--success)' : 'var(--text-tertiary)',
                            border: '1px solid',
                            borderColor: currentStep === i ? 'var(--brand)' : sections[SECTIONS[i].key].trim() ? 'var(--success)' : 'var(--border-subtle)',
                          }}
                        >
                          {sections[SECTIONS[i].key].trim() ? '✓ ' : ''}{step.label}
                        </button>
                      ))}
                    </div>

                    {SECTIONS.map((section, i) => (
                      <div key={section.key} style={{ display: currentStep === i ? 'block' : 'none' }} className="mb-3">
                        <div className="rounded-lg p-3 mb-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                          <p className="text-[12px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{section.label}</p>
                          <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{COPY_STEPS[i].instruction}</p>
                        </div>
                        <textarea
                          value={sections[section.key]}
                          onChange={e => updateSection(section.key, e.target.value)}
                          placeholder={section.placeholder}
                          rows={section.key === 'experience' ? 5 : section.key === 'about' ? 3 : 2}
                          className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none resize-y"
                          style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        />
                        <div className="flex justify-between mt-1">
                          <button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0} className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>← Prev</button>
                          {currentStep < SECTIONS.length - 1 ? (
                            <button onClick={() => setCurrentStep(currentStep + 1)} className="text-[11px]" style={{ color: 'var(--brand)' }}>Next →</button>
                          ) : (
                            <span className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>Done ↓</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        {/* ─── Option 2: Direct paste ─── */}
        {mode === 'paste' && (
          <div>
            <p className="text-[13px] mb-4" style={{ color: 'var(--text-tertiary)' }}>
              Paste your LinkedIn profile sections below.
            </p>
            <div className="space-y-4">
              {SECTIONS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-[13px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                  <textarea
                    value={sections[key]}
                    onChange={e => updateSection(key, e.target.value)}
                    placeholder={placeholder}
                    rows={key === 'experience' ? 6 : key === 'about' ? 4 : 2}
                    className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none resize-y"
                    style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Analyzer sections ─── */}
        {(mode === 'paste' || (mode === 'url' && (urlSaved || linkedinStatus === 'connected'))) && (
          <>
            {/* Section previews when data is loaded */}
            {filledCount > 0 && (
              <div className="mt-5 rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Profile data ({filledCount}/4 sections)</h3>
                  <span className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>Editable — review before analyzing</span>
                </div>
                <div className="space-y-3">
                  {SECTIONS.map(({ key, label }) => sections[key].trim() && (
                    <div key={key}>
                      <label className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                      <textarea
                        value={sections[key]}
                        onChange={e => updateSection(key, e.target.value)}
                        rows={2}
                        className="w-full mt-1 px-3 py-2 rounded-lg border text-[13px] focus:outline-none resize-y"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-[13px] p-3 rounded-lg mt-4" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>{error}</p>
            )}

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="text-[14px] font-medium px-6 py-2.5 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 mt-5"
              style={{ background: 'var(--brand)' }}
            >
              {loading ? 'Analyzing...' : 'Analyze Profile'}
            </button>
          </>
        )}

        {/* ─── Results ─── */}
        {result && (
          <div className="mt-8 space-y-6">
            <div className="rounded-lg border p-6 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              <div className="text-[56px] font-bold leading-none" style={{ color: gradeColor(result.grade) }}>{result.grade}</div>
              <div className="text-[14px] mt-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
                Recruiter Attractiveness Score: <span style={{ color: scoreColor(result.scores.overall) }}>{result.scores.overall}/100</span>
              </div>
              {result.summary && (
                <p className="text-[13px] mt-3 max-w-lg mx-auto" style={{ color: 'var(--text-tertiary)' }}>{result.summary}</p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Object.entries(result.scores).filter(([k]) => k !== 'overall').map(([key, val]) => (
                <div key={key} className="rounded-lg border p-3 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                  <div className="text-[28px] font-bold" style={{ color: scoreColor(val as number) }}>{val as number}</div>
                  <div className="text-[11px] capitalize mt-1" style={{ color: 'var(--text-tertiary)' }}>{key}</div>
                </div>
              ))}
            </div>

            {result.strengths?.length > 0 && (
              <div className="rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-[14px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>✓ Strengths</h3>
                <ul className="space-y-2">
                  {result.strengths.map((s: string, i: number) => (
                    <li key={i} className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.improvements?.length > 0 && (
              <div className="rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-[14px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>↑ Top Improvements</h3>
                <ol className="space-y-2">
                  {result.improvements.map((s: string, i: number) => (
                    <li key={i} className="text-[13px] flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-medium" style={{ color: 'var(--brand)' }}>{i + 1}.</span> {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {result.headlineSuggestions?.length > 0 && (
              <div className="rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-[14px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>💡 Headline Suggestions</h3>
                <div className="space-y-2">
                  {result.headlineSuggestions.map((h: string, i: number) => (
                    <div key={i} className="text-[13px] px-3 py-2 rounded-lg" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>{h}</div>
                  ))}
                </div>
              </div>
            )}

            {result.missingKeywords?.length > 0 && (
              <div className="rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-[14px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>🔑 Missing Keywords to Add</h3>
                <div className="flex flex-wrap gap-2">
                  {result.missingKeywords.map((kw: string, i: number) => (
                    <span key={i} className="text-[12px] px-2.5 py-1 rounded-full" style={{ background: 'var(--bg-surface)', color: 'var(--brand)', border: '1px solid var(--border-subtle)' }}>{kw}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
