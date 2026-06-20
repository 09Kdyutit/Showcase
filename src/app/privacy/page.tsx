import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
export const metadata = { title: 'Privacy Policy · Showcase' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-32 px-4 sm:px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <div className="space-y-8 text-sm text-foreground/80 leading-relaxed">
          {[
            { h: 'What we collect', body: 'We collect your email address, name, and professional information you choose to provide (resume, projects, links). We also collect usage data to improve the product.' },
            { h: 'How we use your data', body: 'We use your data to: generate and display your portfolio, provide ProofScore analysis, deliver the service, and improve our product. We process your resume with OpenAI\'s API under a data processing agreement.' },
            { h: 'What we do not do', body: 'We do not sell your resume or portfolio data to third parties. We do not use your data to train AI models. We do not share your private resume data with other users.' },
            { h: 'Public portfolios', body: 'If you publish your portfolio, it becomes publicly accessible at your portfolio URL. Unpublished portfolios are private and only accessible by you.' },
            { h: 'Data retention', body: 'We retain your data as long as your account is active. You can delete your account and all associated data by contacting support.' },
            { h: 'Security', body: 'We use Supabase with row-level security to ensure your data is only accessible by you. Payment data is handled entirely by Stripe and never stored on our servers.' },
            { h: 'Contact', body: 'For privacy requests, contact support@showcase.app.' },
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
