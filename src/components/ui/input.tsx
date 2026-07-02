import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => (
    <div className="w-full">
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-xl border bg-surface-100 px-3 py-2 text-sm text-foreground',
          'placeholder:text-muted-foreground/60',
          'border-border focus:border-brand-500/60 focus:bg-surface-200',
          'transition-all duration-200 outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          error && 'border-red-500/60 focus:border-red-500',
          className
        )}
        ref={ref}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'

export { Input }
