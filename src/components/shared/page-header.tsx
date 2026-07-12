import { cn } from '@/lib/utils'

// The premium app-page scaffolding: every signed-in page wraps its content in
// <PageShell> (ambient aurora + perspective grid, same living backdrop as the
// dashboard/landing) and opens with <PageHeader> (brand eyebrow + Fraunces
// display headline with an optional italic accent word). Server-safe: no hooks.

export function PageShell({
  children,
  className,
  ambient = true,
}: {
  children: React.ReactNode
  className?: string
  ambient?: boolean
}) {
  return (
    <div className={cn('relative min-h-full', className)}>
      {ambient && (
        <>
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-[420px] aurora-mesh opacity-45" />
          {/* Drifting orbs — the landing hero's depth, echoed inside the app */}
          <div
            className="auth-blob auth-blob-1 pointer-events-none"
            style={{
              top: '-120px',
              right: '8%',
              width: '340px',
              height: '340px',
              background: 'color-mix(in oklch, var(--color-brand-500) 16%, transparent)',
            }}
          />
          <div
            className="auth-blob auth-blob-2 pointer-events-none"
            style={{
              top: '160px',
              left: '-80px',
              width: '280px',
              height: '280px',
              background: 'color-mix(in oklch, oklch(62% 0.22 285) 12%, transparent)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(oklch(97% 0.004 255 / 0.03) 1px, transparent 1px), linear-gradient(90deg, oklch(97% 0.004 255 / 0.03) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse 70% 40% at 10% 0%, black, transparent)',
              WebkitMaskImage: 'radial-gradient(ellipse 70% 40% at 10% 0%, black, transparent)',
            }}
          />
        </>
      )}
      <div className="relative">{children}</div>
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  titleAccent,
  description,
  actions,
  className,
}: {
  /** Small uppercase brand label above the headline, e.g. "Interview Lab". */
  eyebrow: string
  title: string
  /** Optional trailing word rendered in italic serif brand blue — the landing's signature. */
  titleAccent?: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('entrance flex flex-col sm:flex-row sm:items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'oklch(63% 0.20 255)' }}>
          {eyebrow}
        </p>
        <h1 className="text-display text-[1.75rem] sm:text-4xl font-semibold text-foreground text-balance">
          {title}
          {titleAccent && (
            <>
              {' '}
              <em className="not-italic" style={{ fontStyle: 'italic', color: 'oklch(70% 0.17 255)' }}>
                {titleAccent}
              </em>
            </>
          )}
        </h1>
        {description && (
          <p className="text-muted-foreground text-sm mt-1.5 max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  )
}

/** Premium segmented control container — pair with <SegmentedItem>-style buttons. */
export function Segmented({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('inline-flex items-center gap-1 rounded-full p-1 w-fit', className)}
      style={{
        background: 'color-mix(in oklch, var(--color-surface-100) 85%, transparent)',
        border: '1px solid var(--color-border)',
        boxShadow: 'inset 0 1px 0 oklch(100% 0 0 / 0.04)',
      }}
    >
      {children}
    </div>
  )
}

export function segmentedItemClass(active: boolean) {
  return cn(
    'px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200',
    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
  )
}

export function segmentedItemStyle(active: boolean): React.CSSProperties {
  return active
    ? {
        background: 'color-mix(in oklch, var(--color-brand-500) 16%, var(--color-surface-300))',
        border: '1px solid color-mix(in oklch, var(--color-brand-500) 30%, transparent)',
        boxShadow: '0 2px 10px oklch(0% 0 0 / 0.35), inset 0 1px 0 oklch(100% 0 0 / 0.06)',
      }
    : { border: '1px solid transparent' }
}
