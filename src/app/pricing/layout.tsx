import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Start free with résumé import, an editable portfolio, daily career tools, and no credit card. Pro adds live publishing, higher limits, and the complete job-search workspace for $15/month or $150/year.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Showcase Pricing - Start free, publish with Pro',
    description: 'Build and preview a portfolio for free. Upgrade for live publishing, higher limits, application tools, and personalized job matching.',
    url: '/pricing',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
