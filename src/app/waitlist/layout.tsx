import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Showcase access updates',
  description:
    'Showcase connects resume import, an editable portfolio, job matching, tailored application tools, interview practice, opportunities, and Pro publishing.',
  alternates: { canonical: '/' },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'One resume. Your whole job search, connected.',
    description:
      'Build your portfolio, tailor applications, check ATS readiness, practice interviews, and publish when you are ready.',
    url: '/',
  },
}

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return children
}
