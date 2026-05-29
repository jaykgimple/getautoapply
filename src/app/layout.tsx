import './globals.css'

export const metadata = {
  title: 'GetAutoApply — AI Auto Apply Jobs',
  description: 'Auto-apply to jobs with AI. One-click applications, AI-tailored resumes, and job search tracking.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
