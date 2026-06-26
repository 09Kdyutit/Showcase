import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Free gets you a real portfolio draft and your first ProofScore. Pro takes it from draft to shareable  -  publish it, tailor it per role, and fix every evidence gap. $15/month or $150/year.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Showcase Pricing  -  $15/month, no trial that auto-charges',
    description: 'A real free tier so you can see the value before you pay. Upgrade for full generation, publishing, and Tailor Studio.',
    url: '/pricing',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
