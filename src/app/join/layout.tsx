import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Join Showcase',
  description: 'Request early access to Showcase -- the career tool built for the future.',
  robots: { index: false, follow: false },
}

// Completely isolated layout. No navigation, no sidebar, no links to the app.
// This page is a dead end by design.
export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children
}
