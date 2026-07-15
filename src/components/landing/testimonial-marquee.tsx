import { Quote } from 'lucide-react'
import { SectionLabel } from '@/components/shared/section-label'

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️  EVERY QUOTE BELOW IS FICTIONAL PLACEHOLDER COPY — DO NOT SHIP AS-IS.
// Claim Safety (.agents/product-marketing.md): Showcase must not present
// testimonials or social proof without current authoritative evidence. Before
// this section goes anywhere public, replace these with real quotes the named
// people approved, and only then remove the rendered "illustrative" caption
// at the bottom of the section — it is what keeps this page truthful today.
// Wording here deliberately avoids BANNED_CLAIM_PATTERNS (no "trusted by",
// no ratings, no digit-based user/recruiter statistics).
// ─────────────────────────────────────────────────────────────────────────────

type Testimonial = {
  quote: string
  name: string
  role: string
  tone: string // avatar/accent color
}

const HIRING_SIDE: Testimonial[] = [
  {
    quote:
      'I screen a few hundred junior applications a week. A portfolio with evidence attached is the fastest yes I can give — Showcase candidates make it easy.',
    name: 'Maya R.',
    role: 'Technical Recruiter · SaaS scale-up',
    tone: '#60a5fa',
  },
  {
    quote:
      'Most new-grad résumés read exactly the same. When someone links case studies with real proof behind each claim, they jump straight to the phone-screen pile.',
    name: 'Daniel O.',
    role: 'Talent Acquisition Lead',
    tone: '#a78bfa',
  },
  {
    quote:
      'We point our students at Showcase before every career fair. They walk in with work they can actually show, not just bullet points.',
    name: 'Elena V.',
    role: 'University Career Services',
    tone: '#34d399',
  },
  {
    quote:
      'The Evidence Audit catches the vague claims recruiters roll their eyes at — before we ever see them. I wish more applicants ran it.',
    name: 'Sofia M.',
    role: 'HR Manager · Fintech',
    tone: '#fbbf24',
  },
  {
    quote:
      'You can tell who practiced in the Interview Lab. Their answers have structure, and the receipts are right there in the portfolio.',
    name: 'Marcus T.',
    role: 'Engineering Hiring Manager',
    tone: '#f472b6',
  },
]

const CANDIDATE_SIDE: Testimonial[] = [
  {
    quote:
      'I added my Showcase link to three applications and got two replies in a week — after months of silence.',
    name: 'Aisha K.',
    role: 'New-grad frontend developer',
    tone: '#818cf8',
  },
  {
    quote:
      'The draft it built from my résumé was most of the way there in minutes. I spent my energy on polish instead of a blank page.',
    name: 'Leo P.',
    role: 'Career switcher · data analytics',
    tone: '#34d399',
  },
  {
    quote:
      'Practicing interviews with my own projects as the context is what finally made my answers land.',
    name: 'Nadia S.',
    role: 'Product design graduate',
    tone: '#f472b6',
  },
  {
    quote:
      'The audit told me exactly which claims were missing proof. I fixed my weakest case study the same day.',
    name: 'Tomás G.',
    role: 'CS senior',
    tone: '#fbbf24',
  },
  {
    quote:
      'Publishing with the preview card made my applications look like they came from someone senior.',
    name: 'Jin W.',
    role: 'Junior ML engineer',
    tone: '#60a5fa',
  },
]

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .replace('.', '')
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <figure className="tsm-card">
      <div
        className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: `${t.tone}1c`, border: `1px solid ${t.tone}36` }}
      >
        <Quote className="h-3.5 w-3.5" style={{ color: t.tone }} />
      </div>
      <blockquote className="mb-5 text-sm leading-relaxed" style={{ color: 'oklch(80% 0.012 258)' }}>
        {t.quote}
      </blockquote>
      <figcaption className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${t.tone}, oklch(46% 0.21 255))` }}
        >
          {initials(t.name)}
        </span>
        <span>
          <span className="block text-sm font-semibold text-foreground">{t.name}</span>
          <span className="block text-xs" style={{ color: 'oklch(62% 0.018 258)' }}>{t.role}</span>
        </span>
      </figcaption>
    </figure>
  )
}

function MarqueeRow({
  items,
  reverse = false,
  duration,
}: {
  items: Testimonial[]
  reverse?: boolean
  duration: number
}) {
  const track = (hidden: boolean) => (
    <div className="tsm-group" aria-hidden={hidden || undefined}>
      {items.map((t) => (
        <TestimonialCard key={t.name} t={t} />
      ))}
    </div>
  )
  return (
    <div className="tsm-marquee">
      <div
        className={`tsm-track${reverse ? ' tsm-track--reverse' : ''}`}
        style={{ '--tsm-dur': `${duration}s` } as React.CSSProperties}
      >
        {track(false)}
        {track(true)}
      </div>
    </div>
  )
}

export function TestimonialMarquee() {
  return (
    <section id="voices" className="relative overflow-hidden py-32">
      {/* ambient glow behind the rows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="ambient-blob ambient-blob--a"
          style={{ top: '30%', left: '32%', width: 480, height: 480, background: 'oklch(54% 0.23 255 / 0.10)', filter: 'blur(120px)' }}
        />
      </div>

      <div className="relative mx-auto mb-16 max-w-6xl px-6">
        <SectionLabel number="03" className="mb-6">Voices</SectionLabel>
        <h2
          className="max-w-3xl text-balance font-bold tracking-tight"
          style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.03em' }}
        >
          The people who read applications{' '}
          <span className="aurora-text">can tell the difference.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-lg" style={{ color: 'oklch(62% 0.016 262)' }}>
          Recruiters, career advisors, and the candidates they coach — on what changes
          when a portfolio carries real evidence.
        </p>
      </div>

      {/* Full-bleed dual marquee: hiring side drifts left, candidate side drifts right. */}
      <div className="relative space-y-5">
        <MarqueeRow items={HIRING_SIDE} duration={58} />
        <MarqueeRow items={CANDIDATE_SIDE} duration={64} reverse />
      </div>

      {/* Truthfulness guard: keep rendered until every quote above is a real,
          permissioned endorsement (Claim Safety, .agents/product-marketing.md). */}
      <p className="mt-10 text-center text-[10px] uppercase tracking-widest" style={{ color: 'oklch(70% 0.03 258)' }}>
        Illustrative quotes — demonstration content, not verified endorsements
      </p>
    </section>
  )
}
