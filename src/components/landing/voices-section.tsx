import { StaggerTestimonials } from '@/components/ui/stagger-testimonials'
import { SectionLabel } from '@/components/shared/section-label'

// Social-proof section framing the 21st.dev StaggerTestimonials carousel.
// The quotes inside it are FICTIONAL PLACEHOLDERS (see the warning in
// components/ui/stagger-testimonials.tsx); the caption below keeps the page
// truthful and must stay until every quote is a real, permissioned endorsement.
export function VoicesSection() {
  return (
    <section id="voices" className="relative overflow-hidden py-32">
      {/* ambient glow behind the carousel */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="ambient-blob ambient-blob--a"
          style={{ top: '30%', left: '25%', width: 460, height: 460, background: 'oklch(54% 0.23 255 / 0.10)', filter: 'blur(120px)' }}
        />
      </div>

      <div className="relative mx-auto mb-12 max-w-6xl px-6">
        <SectionLabel number="03" className="mb-6">Voices</SectionLabel>
        <h2
          className="max-w-3xl text-balance font-bold tracking-tight"
          style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.03em' }}
        >
          The people who read applications
          <br />can tell the difference.
        </h2>
        <p className="mt-4 max-w-2xl text-lg" style={{ color: 'oklch(62% 0.016 262)' }}>
          Recruiters, career advisors, and the candidates they coach — on what changes
          when a portfolio carries real evidence.
        </p>
      </div>

      <div className="relative">
        <StaggerTestimonials />
      </div>

      {/* Truthfulness guard: must stay rendered until every quote is a real,
          permissioned endorsement (Claim Safety, .agents/product-marketing.md).
          Deliberately quiet fine-print, but do not delete it while the quotes
          are fictional — that would publish fake endorsements as genuine. */}
      <p className="relative mt-6 text-center text-[11px] italic" style={{ color: 'oklch(58% 0.02 258)' }}>
        Illustrative quotes, shown for demonstration.
      </p>
    </section>
  )
}
