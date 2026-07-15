import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Showcase product demo',
  robots: { index: false, follow: false },
}

export default function DemoRootLayout({ children }: { children: React.ReactNode }) {
  return children
}
