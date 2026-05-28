import './globals.css'

export const metadata = {
  title: 'JobBoxOS — AI Job Search Engine',
  description: 'AI-powered job search, auto-tailored resumes, and automated applications.',
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
