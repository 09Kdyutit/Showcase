import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Join the Private Beta',
  description:
    'Your résumé lists claims. Showcase turns them into evidence. Upload your résumé, get a portfolio draft and ProofScore, and see exactly what to fix  -  without inventing a thing. Join the private beta.',
  alternates: { canonical: '/waitlist' },
  openGraph: {
    title: 'Showcase  -  Join the Private Beta',
    description: 'Built for students, new grads, and early-career professionals with real projects but no clear way to prove them.',
    url: '/waitlist',
  },
}

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return children
}
