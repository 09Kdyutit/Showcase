import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Fraunces, Fredoka } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
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

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT', 'WONK'],
})

// Rounded/curvy display font for hero emphasis.
const fredoka = Fredoka({
  variable: '--font-rounded',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

export const metadata: Metadata = {
  // NEXT_PUBLIC_APP_URL is only set for Production. Preview deployments fall back to
  // Vercel's auto-provided per-deployment VERCEL_URL so canonical/OG tags point at the
  // actual preview URL instead of claiming to be the production domain.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://showcase-app-three.vercel.app')
  ),
  title: {
    default: 'Showcase - Your résumé lists claims. Showcase turns them into evidence.',
    template: '%s · Showcase',
  },
  description:
    'Built for students, new grads, and early-career professionals. Upload your résumé and Showcase turns your real experience into a portfolio, scores the strength of its evidence, and tells you exactly what to improve - without inventing a thing.',
  keywords: ['portfolio builder', 'resume analyzer', 'career readiness', 'ProofScore', 'professional portfolio', 'early career job search'],
  authors: [{ name: 'Showcase' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Showcase - Turn your experience into evidence',
    description: 'Your résumé lists claims. Showcase turns them into evidence - without inventing a thing.',
    siteName: 'Showcase',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Showcase - Turn your experience into evidence',
    description: 'Your résumé lists claims. Showcase turns them into evidence - without inventing a thing.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0e0e14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${fredoka.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Analytics />
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'oklch(14% 0.009 255)',
              border: '1px solid oklch(24% 0.011 255)',
              color: 'oklch(97% 0.004 255)',
            },
          }}
        />
      </body>
    </html>
  )
}
