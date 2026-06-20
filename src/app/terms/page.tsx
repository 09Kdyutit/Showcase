import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
export const metadata = { title: 'Terms of Service · Showcase' }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-32 px-4 sm:px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <div className="space-y-8 text-sm text-foreground/80 leading-relaxed">
          {[
            { h: '1. Service Description', body: 'Showcase is an AI-powered portfolio builder and career-readiness analysis tool. We help users present their professional experience more clearly. We do not guarantee employment, interviews, or specific career outcomes. All AI-generated content is based solely on information you provide.' },
            { h: '2. What We Will Never Do', body: 'Showcase will never fabricate experience, credentials, employers, metrics, or projects. Our AI only works with information you supply. If our AI makes an error or hallucination, please report it immediately.' },
            { h: '3. No Employment Guarantee', body: 'Showcase does not guarantee that using our service will result in employment, job interviews, salary increases, or any specific career outcome. Career outcomes depend on many factors outside our control.' },
            { h: '4. User Content', body: 'You retain ownership of all content you upload or create. By uploading content, you grant us a limited license to process and display it within the service. We do not sell your resume or portfolio data.' },
            { h: '5. Subscriptions and Billing', body: 'Pro subscriptions are billed monthly via Stripe. You may cancel at any time. Cancellation takes effect at the end of the current billing period. Refunds are available within 7 days of purchase for unused Pro features per our refund policy.' },
            { h: '6. Prohibited Use', body: 'You may not use Showcase to create fraudulent professional materials, fabricate credentials, or misrepresent your experience to employers. You are responsible for the accuracy of your portfolio.' },
            { h: '7. Limitation of Liability', body: 'Showcase is provided as-is. We are not liable for career outcomes, employment decisions made by third parties, or any damages resulting from use of the service beyond the amount you paid us in the prior 3 months.' },
            { h: '8. Contact', body: 'For questions about these terms, contact support@showcase.app.' },
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
