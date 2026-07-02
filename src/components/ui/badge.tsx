import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'pro' | 'success' | 'warning' | 'danger' | 'info' | 'outline'
}

const variants = {
  default: 'bg-surface-200 text-muted-foreground border border-border',
  pro: 'bg-gradient-to-r from-brand-900 to-brand-800 text-brand-300 border border-brand-500/30',
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  danger: 'bg-red-500/10 text-red-400 border border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  outline: 'border border-border text-muted-foreground',
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
      {...props}
    />
  )
)
Badge.displayName = 'Badge'

export { Badge }
