import { cn } from '@/lib/utils'

// Numbered section label used throughout marketing pages -- "01. HOW IT WORKS"
// with a small decorative squiggle underline. Pure presentational, server-renderable.
export function SectionLabel({
  number,
  children,
  className,
}: {
  number: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {number}. {children}
      </p>
      <svg width="28" height="8" viewBox="0 0 28 8" fill="none" aria-hidden="true">
        <path
          d="M1 5.5C3 2 5 2 7 5.5C9 9 11 9 13 5.5C15 2 17 2 19 5.5C21 9 23 9 25 5.5C26 3.8 26.5 3.2 27 2.5"
          stroke="var(--color-brand-500)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
