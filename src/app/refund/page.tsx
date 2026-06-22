import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
export const metadata = { title: 'Refund Policy · Showcase' }

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-32 px-4 sm:px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-foreground mb-2">Refund Policy</h1>
        <p className="text-muted-foreground mb-12">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <div className="space-y-8 text-sm text-foreground/80 leading-relaxed">
          {[
            { h: 'Our refund policy', body: 'We offer a 7-day money-back guarantee on Pro subscriptions if you have not substantively used Pro features (AI generation, complete audits, public publishing). This gives you time to evaluate whether Showcase is right for you.' },
            { h: 'How to request a refund', body: 'Email support@showcase.app within 7 days of purchase with your email address and reason for the refund. We will process it within 5 business days.' },
            { h: 'What is not refundable', body: 'Refunds are not available after 7 days, or if you have generated multiple portfolios, run multiple audits, or published a portfolio using Pro features.' },
            { h: 'Cancellation', body: 'Cancellation is separate from refunds. You can cancel your subscription at any time from Billing settings. Cancellation stops future charges but does not refund charges already made.' },
          ].map(({ h, body }) => (
            <div key={h}>
              <h2 className="text-lg font-semibold text-foreground mb-3">{h}</h2>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
