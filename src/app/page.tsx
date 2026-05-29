import Link from 'next/link'

/* ─── icon components ─── */
function IconSearch() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}
function IconSparkles() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  )
}
function IconDocument() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}
function IconKanban() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M4.5 19.5h15a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5h-15A1.5 1.5 0 003 6v12a1.5 1.5 0 001.5 1.5z" />
    </svg>
  )
}
function IconChat() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  )
}
function IconChart() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}
function IconArrowRight() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
function IconStar() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}
function IconShield() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}

/* ─── data ─── */
const features = [
  {
    icon: <IconSearch />,
    title: 'Smart Job Sourcing',
    description: 'Aggregate listings from LinkedIn, Indeed, and 50+ job boards. AI surfaces the best matches for your profile and preferences.',
  },
  {
    icon: <IconSparkles />,
    title: 'AI Resume Tailoring',
    description: 'Automatically rewrite your resume for each application. Keyword optimization, ATS scoring, and role-specific highlighting — in seconds.',
  },
  {
    icon: <IconDocument />,
    title: 'One-Click Auto Apply',
    description: 'Auto-fill applications on any careers page. Supports Workday, Greenhouse, Lever, and 200+ ATS platforms. Review and submit in seconds.',
  },
  {
    icon: <IconKanban />,
    title: 'Pipeline Dashboard',
    description: 'Track every application across Saved → Applied → Interview → Offer. Kanban board with status, notes, and timeline.',
  },
  {
    icon: <IconChat />,
    title: 'AI Outreach Engine',
    description: 'Auto-generate personalized recruiter messages. Track responses, schedule follow-ups, and manage your network in one place.',
  },
  {
    icon: <IconChart />,
    title: 'Analytics & Insights',
    description: 'Response rates, application-to-interview ratios, time-to-offer metrics. Know exactly what\'s working and what\'s not.',
  },
]

const steps = [
  {
    num: '01',
    title: 'Connect LinkedIn & upload your resume',
    description: 'Link your LinkedIn profile for AI analysis — get a recruiter attractiveness score, profile enhancement recommendations, and keyword optimization tips. Upload your current resume or build one from scratch.',
  },
  {
    num: '02',
    title: 'AI finds & matches jobs',
    description: 'Our engine scans thousands of listings daily, scoring each against your profile. Only the best matches land in your inbox.',
  },
  {
    num: '03',
    title: 'Auto apply with one click',
    description: 'Review AI-tailored resumes, approve, and auto-submit. The Chrome extension handles forms, answers, and uploads on 200+ platforms.',
  },
  {
    num: '04',
    title: 'Track, iterate, land',
    description: 'Monitor your pipeline, follow up with AI outreach, and optimize based on real performance data until you get the offer.',
  },
]

const testimonials = [
  {
    quote: 'Cut my job search from 6 weeks to 12 days. The AI resume tailoring alone was worth it — my callback rate tripled.',
    name: 'S. Chen',
    role: 'Senior Engineer',
    initials: 'SC',
  },
  {
    quote: 'I was manually applying to 30+ jobs a day. GetAutoApply automated 80% of it and I ended up with more interviews than ever.',
    name: 'M. Johnson',
    role: 'Product Manager',
    initials: 'MJ',
  },
  {
    quote: 'The outreach feature is a game-changer. AI-generated recruiter messages that actually sound human. Got 4 referral conversations in a week.',
    name: 'P. Patel',
    role: 'Design Lead',
    initials: 'PP',
  },
]

const pricingPlans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Try GetAutoApply with core features',
    features: [
      'Up to 10 job saves',
      '3 AI resume generations/mo',
      'Chrome extension (manual mode)',
      'Basic pipeline tracker',
    ],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    description: 'For serious job seekers',
    features: [
      'Unlimited job saves',
      'Unlimited AI resume tailoring',
      'One-click auto-apply (50/mo)',
      'AI outreach messages (100/mo)',
      'Full analytics dashboard',
      'Priority support',
    ],
    cta: 'Start 7-day trial',
    highlighted: true,
  },
  {
    name: 'Teams',
    price: '$49',
    period: '/month',
    description: 'For recruiters and teams',
    features: [
      'Everything in Pro',
      'Multi-seat management',
      'Shared talent pipeline',
      'ATS integrations',
      'Custom branding',
      'Dedicated account manager',
    ],
    cta: 'Contact sales',
    highlighted: false,
  },
]

const faqs = [
  {
    q: 'How does AI resume tailoring work?',
    a: 'Our AI analyzes the job description, extracts key skills and requirements, then rewrites your resume to highlight relevant experience and include matching keywords. Each tailored resume is unique to the role.',
  },
  {
    q: 'Which job boards do you support?',
    a: 'LinkedIn, Indeed, Glassdoor, AngelList, Greenhouse, Workday, Lever, and 50+ more. We aggregate listings continuously and match them to your profile.',
  },
  {
    q: 'How does auto-apply handle different application forms?',
    a: 'Our Chrome extension uses intelligent form detection to auto-fill 95%+ of application fields. For complex applications (portfolio uploads, custom questions), it flags them for quick manual review.',
  },
  {
    q: 'Is my data secure?',
    a: 'Absolutely. We use SOC 2-compliant infrastructure, encrypt all data at rest and in transit, and never share your information with employers or third parties.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No contracts, no cancellation fees. Downgrade to Free at any time and keep all your saved data.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'We offer a 7-day free trial on Pro. If you\'re not satisfied within the first 30 days of a paid plan, we\'ll refund 100% — no questions asked.',
  },
]

/* ─── page ─── */
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>

      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-sm" style={{ background: 'var(--brand)' }}>GA</div>
          <span className="font-medium text-[15px]" style={{ color: 'var(--text-primary)' }}>GetAutoApply</span>
        </Link>
        <div className="hidden sm:flex items-center gap-6">
          <a href="#features" className="text-[13px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Features</a>
          <a href="#how-it-works" className="text-[13px] font-medium" style={{ color: 'var(--text-tertiary)' }}>How it works</a>
          <a href="#pricing" className="text-[13px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Pricing</a>
          <a href="#faq" className="text-[13px] font-medium" style={{ color: 'var(--text-tertiary)' }}>FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors" style={{ color: 'var(--text-secondary)' }}>Log in</Link>
          <Link href="/signup" className="text-[13px] font-medium px-4 py-1.5 rounded-md text-white transition-colors hover:opacity-90" style={{ background: 'var(--brand)' }}>Get started</Link>
        </div>
      </nav>

      <main className="flex-1">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          {/* Glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
            <div className="w-[600px] h-[400px] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, var(--brand) 0%, transparent 70%)' }} />
          </div>
          <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
              <span className="text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Now in public beta — Free tier available</span>
            </div>
            <h1 className="text-[48px] sm:text-[56px] md:text-[64px] font-medium leading-[1.08] tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Auto-apply to jobs
              <br />
              <span style={{ color: 'var(--brand-bright)' }}>with AI</span>
            </h1>
            <p className="mt-6 text-[18px] md:text-[20px] leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--text-tertiary)' }}>
              Source jobs from 50+ boards, auto-tailor ATS-friendly resumes, apply with one click,
              and track every application — all in one dashboard.
            </p>
            <div className="mt-10 flex items-center justify-center gap-3">
              <Link href="/signup" className="text-[14px] font-medium px-6 py-3 rounded-lg text-white transition-all hover:opacity-100 flex items-center gap-2 group" style={{ background: 'var(--brand)' }}>
                Start for free
                <span className="group-hover:translate-x-0.5 transition-transform"><IconArrowRight /></span>
              </Link>
              <Link href="#how-it-works" className="text-[14px] font-medium px-6 py-3 rounded-lg border transition-colors hover:bg-white/[0.03]" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                See how it works
              </Link>
            </div>
            {/* Social proof bar */}
            <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {['SC', 'MJ', 'PP', 'AK'].map((initials, i) => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-semibold" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--bg-base)', color: 'var(--text-secondary)' }}>{initials}</div>
                  ))}
                </div>
                <span className="text-[13px]" style={{ color: 'var(--text-quaternary)' }}>2,400+ job seekers</span>
              </div>
              <div className="flex items-center gap-1" style={{ color: 'var(--warning)' }}>
                {[...Array(5)].map((_, i) => <IconStar key={i} />)}
                <span className="text-[13px] ml-1" style={{ color: 'var(--text-quaternary)' }}>4.9 from 380+ reviews</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Logos / Trust bar ── */}
        <section className="border-y py-10" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="max-w-5xl mx-auto px-6">
            <p className="text-center text-[12px] font-medium uppercase tracking-widest mb-6" style={{ color: 'var(--text-quaternary)' }}>Works with the tools you already use</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {['LinkedIn', 'Indeed', 'Glassdoor', 'Greenhouse', 'Workday', 'Lever'].map(name => (
                <span key={name} className="text-[15px] font-medium" style={{ color: 'var(--text-quaternary)', opacity: 0.6 }}>{name}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Social Proof / Testimonials ── */}
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[13px] font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--brand-bright)' }}>Testimonials</p>
              <h2 className="text-[32px] md:text-[40px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Loved by job seekers
              </h2>
              <p className="mt-3 text-[16px]" style={{ color: 'var(--text-tertiary)' }}>
                Join thousands who've landed their dream role faster.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {testimonials.map((t, i) => (
                <div key={i} className="rounded-xl border p-6 flex flex-col" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-1 mb-4" style={{ color: 'var(--warning)' }}>
                    {[...Array(5)].map((_, j) => <IconStar key={j} />)}
                  </div>
                  <p className="text-[15px] leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold" style={{ background: 'var(--brand)', color: 'white' }}>{t.initials}</div>
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                      <p className="text-[12px]" style={{ color: 'var(--text-quaternary)' }}>{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="py-24 px-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[13px] font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--brand-bright)' }}>Features</p>
              <h2 className="text-[32px] md:text-[40px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Everything you need to land the role
              </h2>
              <p className="mt-3 text-[16px] max-w-xl mx-auto" style={{ color: 'var(--text-tertiary)' }}>
                From sourcing to offer letter, GetAutoApply automates the entire job search workflow.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f, i) => (
                <div key={i} className="rounded-xl border p-6 group hover:border-opacity-100 transition-colors" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(94,106,210,0.1)', color: 'var(--brand-bright)' }}>
                    {f.icon}
                  </div>
                  <h3 className="text-[16px] font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
                  <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" className="py-24 px-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[13px] font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--brand-bright)' }}>How it works</p>
              <h2 className="text-[32px] md:text-[40px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Land your next job in 4 steps
              </h2>
            </div>
            <div className="space-y-0">
              {steps.map((s, i) => (
                <div key={i} className="flex gap-6 pb-12 last:pb-0 relative">
                  {i < steps.length - 1 && (
                    <div className="absolute left-[23px] top-[52px] bottom-0 w-px" style={{ background: 'var(--border-subtle)' }} />
                  )}
                  <div className="flex-shrink-0 w-[48px] h-[48px] rounded-full border flex items-center justify-center text-[14px] font-semibold z-10" style={{ background: 'var(--bg-panel)', borderColor: 'var(--brand)', color: 'var(--brand-bright)' }}>
                    {s.num}
                  </div>
                  <div className="pt-2">
                    <h3 className="text-[18px] font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{s.title}</h3>
                    <p className="text-[15px] leading-relaxed max-w-lg" style={{ color: 'var(--text-tertiary)' }}>{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="py-20 px-6 border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}>
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: '500K+', label: 'Applications sent' },
                { value: '73%', label: 'Higher callback rate' },
                { value: '50+', label: 'Job boards covered' },
                { value: '12 days', label: 'Avg. time to offer' },
              ].map((stat, i) => (
                <div key={i}>
                  <p className="text-[32px] md:text-[40px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                  <p className="text-[13px] mt-1" style={{ color: 'var(--text-quaternary)' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="py-24 px-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[13px] font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--brand-bright)' }}>Pricing</p>
              <h2 className="text-[32px] md:text-[40px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Simple, transparent pricing
              </h2>
              <p className="mt-3 text-[16px]" style={{ color: 'var(--text-tertiary)' }}>
                Start free. Upgrade when you're ready.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {pricingPlans.map((plan, i) => (
                <div key={i} className="rounded-xl border p-6 flex flex-col" style={{
                  background: plan.highlighted ? 'var(--bg-surface)' : 'var(--bg-panel)',
                  borderColor: plan.highlighted ? 'var(--brand)' : 'var(--border-subtle)',
                  boxShadow: plan.highlighted ? '0 0 0 1px rgba(94,106,210,0.2)' : 'none',
                }}>
                  {plan.highlighted && (
                    <span className="inline-block self-start text-[11px] font-semibold px-2 py-0.5 rounded-full mb-4" style={{ background: 'rgba(94,106,210,0.15)', color: 'var(--brand-bright)' }}>Most popular</span>
                  )}
                  <h3 className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>{plan.name}</h3>
                  <div className="mt-3 mb-1">
                    <span className="text-[40px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>{plan.price}</span>
                    <span className="text-[14px] ml-1" style={{ color: 'var(--text-quaternary)' }}>{plan.period}</span>
                  </div>
                  <p className="text-[13px] mb-6" style={{ color: 'var(--text-quaternary)' }}>{plan.description}</p>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                        <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--success)' }}><IconCheck /></span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.name === 'Teams' ? '#contact' : '/signup'}
                    className="block w-full text-center text-[14px] font-medium py-2.5 rounded-lg transition-colors"
                    style={plan.highlighted
                      ? { background: 'var(--brand)', color: 'white' }
                      : { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
                    }
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="py-24 px-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[13px] font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--brand-bright)' }}>FAQ</p>
              <h2 className="text-[32px] md:text-[40px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Frequently asked questions
              </h2>
            </div>
            <div className="space-y-1">
              {faqs.map((faq, i) => (
                <details key={i} className="group rounded-lg border px-5 py-4 cursor-pointer" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
                  <summary className="flex items-center justify-between text-[15px] font-medium list-none" style={{ color: 'var(--text-primary)' }}>
                    {faq.q}
                    <svg className="w-4 h-4 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-quaternary)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </summary>
                  <p className="mt-3 text-[14px] leading-relaxed pr-6" style={{ color: 'var(--text-tertiary)' }}>{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-24 px-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(94,106,210,0.1)', color: 'var(--brand-bright)' }}>
              <IconShield />
            </div>
            <h2 className="text-[32px] md:text-[40px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Ready to land your next
              <br />
              <span style={{ color: 'var(--brand-bright)' }}>dream role?</span>
            </h2>
            <p className="mt-4 text-[16px] max-w-lg mx-auto" style={{ color: 'var(--text-tertiary)' }}>
              Stop manually applying. Start letting AI auto-apply for you. No credit card required.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link href="/signup" className="text-[14px] font-medium px-6 py-3 rounded-lg text-white flex items-center gap-2 group" style={{ background: 'var(--brand)' }}>
                Get started for free
                <span className="group-hover:translate-x-0.5 transition-transform"><IconArrowRight /></span>
              </Link>
            </div>
            <p className="mt-4 text-[13px]" style={{ color: 'var(--text-quaternary)' }}>Free tier · No credit card · Cancel anytime</p>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t py-10 px-6" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <p className="text-[13px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Product</p>
              <ul className="space-y-2">
                {['Features', 'Pricing', 'Chrome Extension', 'Changelog'].map(l => (
                  <li key={l}><a href="#" className="text-[13px] hover:underline" style={{ color: 'var(--text-quaternary)' }}>{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Company</p>
              <ul className="space-y-2">
                {['About', 'Blog', 'Careers', 'Contact'].map(l => (
                  <li key={l}><a href="#" className="text-[13px] hover:underline" style={{ color: 'var(--text-quaternary)' }}>{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Resources</p>
              <ul className="space-y-2">
                {['Docs', 'API', 'Community', 'Status'].map(l => (
                  <li key={l}><a href="#" className="text-[13px] hover:underline" style={{ color: 'var(--text-quaternary)' }}>{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Legal</p>
              <ul className="space-y-2">
                {['Privacy', 'Terms', 'Security', 'GDPR'].map(l => (
                  <li key={l}><a href="#" className="text-[13px] hover:underline" style={{ color: 'var(--text-quaternary)' }}>{l}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center text-white font-semibold text-[10px]" style={{ background: 'var(--brand)' }}>GA</div>
              <span className="text-[13px]" style={{ color: 'var(--text-quaternary)' }}>© 2026 GetAutoApply. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="#" className="text-[13px] hover:underline" style={{ color: 'var(--text-quaternary)' }}>Twitter</a>
              <a href="#" className="text-[13px] hover:underline" style={{ color: 'var(--text-quaternary)' }}>GitHub</a>
              <a href="#" className="text-[13px] hover:underline" style={{ color: 'var(--text-quaternary)' }}>Discord</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
