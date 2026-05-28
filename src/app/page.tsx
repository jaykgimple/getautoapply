import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-sm" style={{ background: 'var(--brand)' }}>
            JB
          </div>
          <span className="font-medium text-[15px]" style={{ color: 'var(--text-primary)' }}>JobBoxOS</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors" style={{ color: 'var(--text-secondary)' }}>
            Log in
          </Link>
          <Link href="/signup" className="text-[13px] font-medium px-4 py-1.5 rounded-md text-white transition-colors" style={{ background: 'var(--brand)' }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-[48px] font-medium leading-[1.1] tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Your AI job search
            <br />
            <span style={{ color: 'var(--brand-bright)' }}>command center</span>
          </h1>
          <p className="mt-6 text-[18px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            Source jobs, auto-tailor ATS-friendly resumes, apply with one click,
            and track every application — all powered by AI.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/signup" className="text-[14px] font-medium px-6 py-2.5 rounded-lg text-white transition-colors hover:opacity-90" style={{ background: 'var(--brand)' }}>
              Start for free
            </Link>
            <Link href="/login" className="text-[14px] font-medium px-6 py-2.5 rounded-lg border transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              Sign in
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 border-t text-center" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-[13px]" style={{ color: 'var(--text-quaternary)' }}>© 2026 JobBoxOS. All rights reserved.</p>
      </footer>
    </div>
  )
}
