'use client'

import { Lock, Zap } from 'lucide-react'
import { Button } from './button'
import { useRouter } from 'next/navigation'

interface PaywallProps {
  feature: string
  description: string
  className?: string
}

export function PaywallCard({ feature, description, className }: PaywallProps) {
  const router = useRouter()

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-50 to-card p-6 ${className}`}>
      <div className="relative flex flex-col items-center text-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20">
          <Lock className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground mb-1">{feature}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          variant="gradient"
          size="md"
          onClick={() => router.push('/billing')}
          className="gap-2"
        >
          <Zap className="h-4 w-4" />
          Upgrade to Pro
        </Button>
        <p className="text-xs text-muted-foreground">$15/month · Cancel anytime</p>
      </div>
    </div>
  )
}

export function PaywallInline({ feature }: { feature: string }) {
  const router = useRouter()
  return (
    <div className="flex items-center gap-2 text-sm">
      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">{feature} requires</span>
      <button
        onClick={() => router.push('/billing')}
        className="text-brand-600 hover:text-brand-700 font-medium transition-colors"
      >
        Pro →
      </button>
    </div>
  )
}
