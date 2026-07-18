import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
export const metadata = { title: 'Terms of Service · Showcase' }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-32 px-4 sm:px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">Effective July 9, 2026</p>
        <div className="space-y-8 text-sm text-foreground/80 leading-relaxed">
          {[
            { h: '1. Service Description', body: 'Showcase is an AI-powered portfolio builder and career-readiness analysis tool. We help users present their professional experience more clearly. We do not guarantee employment, interviews, or specific career outcomes. AI generation uses the information you provide as its source context.' },
            { h: '2. Reviewing AI Output', body: 'Showcase is designed to keep drafts grounded in the experience and details you supply, but AI can make errors or add unsupported wording. You are responsible for reviewing and correcting generated content before using or publishing it. Please report suspected hallucinations.' },
            { h: '3. No Employment Guarantee', body: 'Showcase does not guarantee that using our service will result in employment, job interviews, salary increases, or any specific career outcome. Career outcomes depend on many factors outside our control.' },
            { h: '4. User Content', body: 'You retain ownership of all content you upload or create. By uploading content, you grant us a limited license to process and display it within the service. We do not sell your resume or portfolio data.' },
            { h: '5. Subscriptions and Billing', body: 'Pro subscriptions are billed monthly or annually via Stripe, depending on the plan selected. Founding subscriptions renew annually at their stated grandfathered price while continuously subscribed. You may cancel at any time; cancellation takes effect at the end of the current billing period. Refund requests made within 7 days are eligible only when Pro features have not been substantively used, as described in our refund policy.' },
            { h: '6. Prohibited Use', body: 'You may not use Showcase to create fraudulent professional materials, fabricate credentials, or misrepresent your experience to employers. You are responsible for the accuracy of your portfolio.' },
            { h: '7. Limitation of Liability', body: 'Showcase is provided as-is. We are not liable for career outcomes, employment decisions made by third parties, or any damages resulting from use of the service beyond the amount you paid us in the prior 3 months.' },
            { h: '8. Contact', body: 'For questions about these terms, contact hello@tryshowcase.ink.' },
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
