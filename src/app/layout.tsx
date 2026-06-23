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
  // Fallback matches the actual current Vercel deployment, not an aspirational/unregistered
  // domain — NEXT_PUBLIC_APP_URL should always be set explicitly per environment, but this
  // must still resolve to something real if it's ever missing in a preview deploy.
  // showcase-app-three.vercel.app is the consolidated production project (showcase-app);
  // casefile-ten.vercel.app is a legacy backup deployment, never used as a fallback target.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://showcase-app-three.vercel.app'),
  title: {
    default: 'Showcase — Your résumé lists claims. Showcase turns them into evidence.',
    template: '%s · Showcase',
  },
  description:
    'Built for students, new grads, and early-career professionals. Upload your résumé and Showcase turns your real experience into a portfolio, scores the strength of its evidence, and tells you exactly what to improve — without inventing a thing.',
  keywords: ['portfolio builder', 'resume analyzer', 'career readiness', 'ProofScore', 'professional portfolio', 'early career job search'],
  authors: [{ name: 'Showcase' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Showcase — Turn your experience into evidence',
    description: 'Your résumé lists claims. Showcase turns them into evidence — without inventing a thing.',
    siteName: 'Showcase',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Showcase — Turn your experience into evidence',
    description: 'Your résumé lists claims. Showcase turns them into evidence — without inventing a thing.',
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
