import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
export const metadata = { title: 'Refund Policy · Showcase' }

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-32 px-4 sm:px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-foreground mb-2">Refund Policy</h1>
        <p className="text-muted-foreground mb-12">Effective July 9, 2026</p>
        <div className="space-y-8 text-sm text-foreground/80 leading-relaxed">
          {[
            { h: 'Our refund policy', body: 'You may request a refund within 7 days of purchasing Pro if you have not substantively used paid features such as portfolio regeneration, live publishing, or paid-tier interview capacity.' },
            { h: 'How to request a refund', body: 'Email hello@tryshowcase.ink within 7 days of purchase with your account email and reason for the refund. We will review the account against this policy and respond as soon as reasonably practical.' },
            { h: 'What is not refundable', body: 'Refunds are not available after 7 days or after substantive use of paid features, including multiple portfolio generations, public publishing, or paid-tier interview capacity.' },
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
