'use client'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <a href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-sm" style={{ background: 'var(--brand)' }}>GA</div>
          <span className="font-medium text-[15px]" style={{ color: 'var(--text-primary)' }}>GetAutoApply</span>
        </a>
        <a href="/" className="text-[13px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Back to home</a>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-[36px] font-medium tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>Privacy Policy</h1>
        <p className="text-[14px] mb-10" style={{ color: 'var(--text-quaternary)' }}>Last updated: May 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>

          <section>
            <h2 className="text-[18px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>1. Introduction</h2>
            <p>GetAutoApply ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application and related services (the "Service").</p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>2. Information We Collect</h2>
            <p className="mb-2">We collect information you provide directly:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account data:</strong> Email address, password (hashed), and authentication credentials via Supabase Auth.</li>
              <li><strong>Profile data:</strong> Name, headline, location, and any information you choose to include in your professional profile.</li>
              <li><strong>Resume data:</strong> Uploaded resumes, parsed resume content (JSON), and AI-generated resume variants.</li>
              <li><strong>Job data:</strong> Saved job listings, application status, notes, calendar events, and contacts.</li>
              <li><strong>Usage data:</strong> Search queries, application history, and feature interaction data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[18px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide, maintain, and improve the Service.</li>
              <li>To match job listings to your profile using algorithmic scoring.</li>
              <li>To auto-generate tailored resumes using AI.</li>
              <li>To auto-fill and submit job applications on your behalf.</li>
              <li>To send notifications, reminders, and service-related communications.</li>
              <li>To analyze usage patterns and improve our algorithms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[18px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>4. Data Storage & Security</h2>
            <p>Your data is stored in Supabase (PostgreSQL) hosted on AWS infrastructure. We use industry-standard encryption in transit (TLS) and at rest. Access to your data is protected by Row Level Security (RLS) policies that ensure you can only access your own data. We never sell, rent, or share your personal information with third parties for marketing purposes.</p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>5. Third-Party Services</h2>
            <p>We integrate with third-party services to provide job search functionality:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>LinkedIN:</strong> For job search and authentication (OAuth). Subject to LinkedIn's privacy policy.</li>
              <li><strong>RapidAPI (JSearch):</strong> For aggregated job listings.</li>
              <li><strong>SerpApi:</strong> For Google Jobs results.</li>
              <li><strong>Indeed RSS:</strong> For public job feeds.</li>
            </ul>
            <p className="mt-2">These services receive only the minimum query data needed to return results. Your personal data is not shared with job boards unless you explicitly apply to a listing.</p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>6. Your Rights (GDPR / CCPA)</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access, update, or delete your personal data at any time from your dashboard.</li>
              <li>Export your data in a portable format.</li>
              <li>Withdraw consent for data processing.</li>
              <li>Request deletion of your account and all associated data.</li>
            </ul>
            <p className="mt-2">All of the above rights can be exercised directly from your account settings. Visit Settings → Account to access your data, export it, or permanently delete your account and all associated data.</p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>7. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use tracking cookies or advertising cookies. Analytics are performed using aggregated, anonymized data.</p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>8. Children&apos;s Privacy</h2>
            <p>The Service is not intended for users under 18. We do not knowingly collect data from children.</p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the "Last updated" date and, where appropriate, via email or in-app notification.</p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 px-6" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-[13px]" style={{ color: 'var(--text-quaternary)' }}>© 2026 GetAutoApply. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="text-[13px] hover:underline" style={{ color: 'var(--text-quaternary)' }}>Privacy</a>
            <a href="/terms" className="text-[13px] hover:underline" style={{ color: 'var(--text-quaternary)' }}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
