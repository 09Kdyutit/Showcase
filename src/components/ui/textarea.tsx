import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <div className="w-full">
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-xl border bg-surface-100 px-3 py-2.5 text-sm text-foreground',
          'placeholder:text-muted-foreground/60',
          'border-border focus:border-brand-500/60 focus:bg-surface-200',
          'transition-all duration-200 outline-none resize-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-500/60',
          className
        )}
        ref={ref}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'

export { Textarea }
