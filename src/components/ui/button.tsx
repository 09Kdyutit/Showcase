'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'link' | 'gradient'
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon'
  asChild?: boolean
  loading?: boolean
}

const variants = {
  primary: 'bg-brand-500 hover:bg-brand-600 text-white shadow-glow-sm hover:shadow-glow transition-all duration-200 active:scale-[0.98]',
  gradient: 'bg-gradient-to-r from-brand-500 to-violet-500 hover:from-brand-600 hover:to-violet-600 text-white shadow-glow-sm hover:shadow-glow transition-all duration-200 active:scale-[0.98]',
  secondary: 'bg-surface-200 hover:bg-surface-300 text-foreground border border-border hover:border-white/20 transition-all duration-200',
  ghost: 'hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all duration-200',
  outline: 'border border-border hover:border-brand-500/50 hover:bg-brand-500/5 text-foreground transition-all duration-200',
  destructive: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-all duration-200',
  link: 'text-brand-400 hover:text-brand-300 underline-offset-4 hover:underline p-0 h-auto',
}

const sizes = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-9 px-4 text-sm rounded-lg gap-2',
  lg: 'h-11 px-6 text-sm rounded-xl gap-2',
  xl: 'h-13 px-8 text-base rounded-xl gap-2.5',
  icon: 'h-9 w-9 rounded-lg',
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center font-medium whitespace-nowrap cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-40',
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button }
