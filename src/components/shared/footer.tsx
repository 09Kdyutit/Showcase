import Link from 'next/link'
import { Logo } from '@/components/shared/logo'

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-surface-50/30 py-14 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-2">
            <div className="mb-4">
              <Logo />
            </div>
            <p className="text-sm font-medium text-foreground/80 mb-2">
              Your experience, presented better.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Turn your résumé into an editable portfolio, then use the same
              experience to apply and prepare.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Product</p>
            <ul className="space-y-2.5">
              {[
                { href: '/pricing', label: 'Pricing' },
                { href: '/#how-it-works', label: 'How it works' },
                { href: '/resume-to-portfolio', label: 'Résumé to portfolio' },
                { href: '/for-career-services', label: 'For career services teams' },
                { href: '/login', label: 'Sign in' },
                { href: '/signup', label: 'Create my portfolio free' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 max-md:py-1.5 max-md:inline-block">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Legal</p>
            <ul className="space-y-2.5">
              {[
                { href: '/terms', label: 'Terms of Service' },
                { href: '/privacy', label: 'Privacy Policy' },
                { href: '/refund', label: 'Refund Policy' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 max-md:py-1.5 max-md:inline-block">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Showcase. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground font-serif italic">
            AI-assisted. Editable. Always yours to review.
          </p>
        </div>
      </div>
    </footer>
  )
}
