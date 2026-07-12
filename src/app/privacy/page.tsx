import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
export const metadata = { title: 'Privacy Policy · Showcase' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-32 px-4 sm:px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Effective July 9, 2026</p>
        <div className="space-y-8 text-sm text-foreground/80 leading-relaxed">
          {[
            { h: 'What we collect', body: 'We collect your email address, name, and professional information you choose to provide (resume, projects, links). We also collect usage data to improve the product.' },
            { h: 'How we use your data', body: 'We use your data to generate and display your portfolio, provide requested evidence audits and other analysis, deliver emails, secure the service, process billing, and improve the product. This requires service providers including Supabase (hosting and authentication), OpenAI (requested AI analysis and generation), Stripe (billing), Resend (email), and any job-data provider enabled for search.' },
            { h: 'What we do not do', body: 'We do not sell your resume or portfolio data. We do not use it to train our own AI models, and we do not expose private resume data to other Showcase users.' },
            { h: 'Public portfolios', body: 'If you publish your portfolio, it becomes publicly accessible at your portfolio URL. Unpublished portfolios are private and only accessible by you.' },
            { h: 'Data retention and deletion', body: 'User-owned app records are retained while your account is active and are deleted when you use Delete account in Settings. Showcase first removes uploaded files associated with your user prefix from each storage bucket; if that cleanup cannot complete, deletion returns an error and keeps the account so you can retry or contact us. A waitlist record may remain after being unlinked from the deleted account, suppression records may remain so we continue honoring opt-outs, provider webhook identifiers may remain for security, and Stripe retains customer and payment records under its own legal and operational requirements.' },
            { h: 'Security and payments', body: 'We use Supabase row-level security and server-side authorization to separate user data. Stripe handles card and bank details; Showcase stores only the Stripe customer/subscription identifiers and plan status needed to manage access.' },
            { h: 'Contact', body: 'For privacy requests, contact hello@tryshowcase.ink.' },
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
