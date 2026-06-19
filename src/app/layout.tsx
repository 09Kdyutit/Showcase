import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Showcase — Turn your experience into evidence',
    template: '%s · Showcase',
  },
  description:
    'Turn your resume, projects, and work history into a professional proof-of-work portfolio. Get your ProofScore and know exactly where you stand.',
  keywords: ['portfolio builder', 'resume analyzer', 'career readiness', 'ProofScore', 'professional portfolio'],
  authors: [{ name: 'Showcase' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Showcase — Turn your experience into evidence',
    description: 'Stop telling employers you are qualified. Show them.',
    siteName: 'Showcase',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Showcase — Turn your experience into evidence',
    description: 'Stop telling employers you are qualified. Show them.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#09090b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-surface-200)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-foreground)',
            },
          }}
        />
      </body>
    </html>
  )
}
