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
//
// Design: the 21st.dev "3D testimonials" pattern — a perspective-tilted plane
// of three columns scrolling vertically at different speeds (middle reversed),
// masked top/bottom, pause on hover. Styles live in globals.css (.tsw-*).
// ─────────────────────────────────────────────────────────────────────────────

type Testimonial = {
  quote: string
  name: string
  role: string
  tone: string // accent color for the card glow + avatar
}

// Columns mix hiring-side and candidate voices so no column reads one-note.
const COL_A: Testimonial[] = [
  {
    quote:
      'I screen a few hundred junior applications a week. A portfolio with evidence attached is the fastest yes I can give — Showcase candidates make it easy.',
    name: 'Maya R.',
    role: 'Technical Recruiter · SaaS scale-up',
    tone: '#60a5fa',
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
      'The Evidence Audit catches the vague claims recruiters roll their eyes at — before we ever see them. I wish more applicants ran it.',
    name: 'Sofia M.',
    role: 'HR Manager · Fintech',
    tone: '#fbbf24',
  },
  {
    quote:
      'I added my Showcase link to three applications and got two replies in a week — after months of silence.',
    name: 'Aisha K.',
    role: 'New-grad frontend developer',
    tone: '#818cf8',
  },
]

const COL_B: Testimonial[] = [
  {
    quote:
      'Most new-grad résumés read exactly the same. When someone links case studies with real proof behind each claim, they jump straight to the phone-screen pile.',
    name: 'Daniel O.',
    role: 'Talent Acquisition Lead',
    tone: '#a78bfa',
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
      'You can tell who practiced in the Interview Lab. Their answers have structure, and the receipts are right there in the portfolio.',
    name: 'Marcus T.',
    role: 'Engineering Hiring Manager',
    tone: '#f472b6',
  },
]

const COL_C: Testimonial[] = [
  {
    quote:
      'We point our students at Showcase before every career fair. They walk in with work they can actually show, not just bullet points.',
    name: 'Elena V.',
    role: 'University Career Services',
    tone: '#34d399',
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

function WallCard({ t }: { t: Testimonial }) {
  return (
    <figure className="tsw-card" style={{ '--tone': t.tone } as React.CSSProperties}>
      <Quote className="tsw-watermark" aria-hidden />
      <blockquote className="relative mb-5 text-sm leading-relaxed" style={{ color: 'oklch(82% 0.012 258)' }}>
        {t.quote}
      </blockquote>
      <figcaption className="relative flex items-center gap-3">
        <span className="tsw-avatar" style={{ background: `linear-gradient(135deg, ${t.tone}, oklch(46% 0.21 255))` }}>
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

function WallColumn({
  items,
  duration,
  reverse = false,
  className = '',
}: {
  items: Testimonial[]
  duration: number
  reverse?: boolean
  className?: string
}) {
  const stack = (hidden: boolean) => (
    <div className="tsw-stack" aria-hidden={hidden || undefined}>
      {items.map((t) => (
        <WallCard key={t.name} t={t} />
      ))}
    </div>
  )
  return (
    <div className={`tsw-colwrap ${className}`}>
      <div
        className={`tsw-col${reverse ? ' tsw-col--reverse' : ''}`}
        style={{ '--tsw-dur': `${duration}s` } as React.CSSProperties}
      >
        {stack(false)}
        {stack(true)}
      </div>
    </div>
  )
}

export function TestimonialWall() {
  return (
    <section id="voices" className="relative overflow-hidden py-32">
      {/* ambient glow behind the wall */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="ambient-blob ambient-blob--a"
          style={{ top: '28%', left: '18%', width: 460, height: 460, background: 'oklch(54% 0.23 255 / 0.12)', filter: 'blur(120px)' }}
        />
        <div
          className="ambient-blob ambient-blob--b"
          style={{ bottom: '2%', right: '10%', width: 400, height: 400, background: 'oklch(58% 0.20 290 / 0.10)', filter: 'blur(120px)' }}
        />
      </div>

      <div className="relative mx-auto mb-14 max-w-6xl px-6">
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

      {/* The tilted wall */}
      <div className="tsw-stage relative mx-auto max-w-6xl px-6">
        <div className="tsw-plane">
          <div className="tsw-wall">
            <WallColumn items={COL_A} duration={46} />
            <WallColumn items={COL_B} duration={60} reverse className="tsw-col-b" />
            <WallColumn items={COL_C} duration={52} className="tsw-col-c" />
          </div>
        </div>
      </div>

      {/* Truthfulness guard: keep rendered until every quote above is a real,
          permissioned endorsement (Claim Safety, .agents/product-marketing.md). */}
      <p className="relative mt-10 text-center text-[10px] uppercase tracking-widest" style={{ color: 'oklch(70% 0.03 258)' }}>
        Illustrative quotes — demonstration content, not verified endorsements
      </p>
    </section>
  )
}
