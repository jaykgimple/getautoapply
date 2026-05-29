'use client'

import { useState } from 'react'

const SECTIONS = [
  { key: 'headline', label: 'Headline', placeholder: 'e.g. Senior Software Engineer | React | Node.js | Building scalable web apps' },
  { key: 'about', label: 'About / Summary', placeholder: 'Paste your LinkedIn About section here...' },
  { key: 'experience', label: 'Experience', placeholder: 'Paste your job titles, companies, and descriptions...' },
  { key: 'skills', label: 'Skills', placeholder: 'List your skills (comma-separated or one per line)...' },
]

export default function LinkedInAnalyzer() {
  const [mode, setMode] = useState<'url' | 'paste'>('url')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [sections, setSections] = useState<Record<string, string>>({
    headline: '',
    about: '',
    experience: '',
    skills: '',
  })
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)

  const updateSection = (key: string, value: string) => {
    setSections(prev => ({ ...prev, [key]: value }))
  }

  const handleFetchProfile = async () => {
    if (!linkedinUrl.trim()) {
      setError('Please enter a LinkedIn profile URL.')
      return
    }
    setFetching(true)
    setError('')

    try {
      const response = await fetch('/api/ai/linkedin/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkedinUrl.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch profile')

      // Pre-fill sections with fetched data
      if (data.profile) {
        setSections({
          headline: data.profile.headline || '',
          about: data.profile.about || '',
          experience: data.profile.experience || '',
          skills: data.profile.skills || '',
        })
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch LinkedIn profile. You can paste your info manually below.')
    } finally {
      setFetching(false)
    }
  }

  const handleAnalyze = async () => {
    const profileText = Object.entries(sections)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `${k.toUpperCase()}:\n${v.trim()}`)
      .join('\n\n')

    if (profileText.length < 50) {
      setError('Please fill in at least one section of your LinkedIn profile.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/ai/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileText }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Analysis failed')
      }
      const data = await response.json()
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
            Option 1: Profile URL
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
            Option 2: Paste Info
          </button>
        </div>

        {/* Option 1: URL */}
        {mode === 'url' && (
          <div className="rounded-lg border p-5 mb-6" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-[14px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Paste LinkedIn Profile URL</h3>
            <p className="text-[12px] mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Enter your public LinkedIn profile URL. We&apos;ll fetch your profile and auto-fill the fields below for review.
            </p>
            <input
              type="url"
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/your-name"
              className="w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none mb-3"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={handleFetchProfile}
              disabled={fetching}
              className="text-[13px] font-medium px-5 py-2 rounded-lg text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--brand)' }}
            >
              {fetching ? 'Fetching...' : 'Fetch Profile'}
            </button>
          </div>
        )}

        {/* Option 2: Manual paste intro */}
        {mode === 'paste' && (
          <div className="mb-4">
            <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
              Paste your LinkedIn profile sections below. You can find these on your LinkedIn profile page — just copy and paste each section.
            </p>
          </div>
        )}

        {/* Editable sections (shown for both modes; auto-filled for URL mode) */}
        <div className="space-y-4 mb-6">
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

        {error && (
          <p className="text-[13px] p-3 rounded-lg mb-4" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>{error}</p>
        )}

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="text-[14px] font-medium px-6 py-2.5 rounded-lg text-white transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--brand)' }}
        >
          {loading ? 'Analyzing...' : 'Analyze Profile'}
        </button>

        {/* Results */}
        {result && (
          <div className="mt-8 space-y-6">
            {/* Overall score */}
            <div className="rounded-lg border p-6 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
              <div className="text-[56px] font-bold leading-none" style={{ color: gradeColor(result.grade) }}>{result.grade}</div>
              <div className="text-[14px] mt-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
                Recruiter Attractiveness Score: <span style={{ color: scoreColor(result.scores.overall) }}>{result.scores.overall}/100</span>
              </div>
              {result.summary && (
                <p className="text-[13px] mt-3 max-w-lg mx-auto" style={{ color: 'var(--text-tertiary)' }}>{result.summary}</p>
              )}
            </div>

            {/* Category scores */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Object.entries(result.scores)
                .filter(([k]) => k !== 'overall')
                .map(([key, val]) => (
                  <div key={key} className="rounded-lg border p-3 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                    <div className="text-[28px] font-bold" style={{ color: scoreColor(val as number) }}>{val as number}</div>
                    <div className="text-[11px] capitalize mt-1" style={{ color: 'var(--text-tertiary)' }}>{key}</div>
                  </div>
                ))}
            </div>

            {/* Strengths */}
            {result.strengths?.length > 0 && (
              <div className="rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-[14px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>✓ Strengths</h3>
                <ul className="space-y-2">
                  {result.strengths.map((s: string, i: number) => (
                    <li key={i} className="text-[13px] flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--success)' }}>•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Improvements */}
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

            {/* Headline suggestions */}
            {result.headlineSuggestions?.length > 0 && (
              <div className="rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-[14px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>💡 Headline Suggestions</h3>
                <div className="space-y-2">
                  {result.headlineSuggestions.map((h: string, i: number) => (
                    <div key={i} className="text-[13px] px-3 py-2 rounded-lg" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                      {h}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing keywords */}
            {result.missingKeywords?.length > 0 && (
              <div className="rounded-lg border p-5" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-[14px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>🔑 Missing Keywords to Add</h3>
                <div className="flex flex-wrap gap-2">
                  {result.missingKeywords.map((kw: string, i: number) => (
                    <span key={i} className="text-[12px] px-2.5 py-1 rounded-full" style={{ background: 'var(--bg-surface)', color: 'var(--brand)', border: '1px solid var(--border-subtle)' }}>
                      {kw}
                    </span>
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
