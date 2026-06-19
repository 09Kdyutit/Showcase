import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-surface-50/30 py-14 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">S</span>
              </div>
              <span className="font-bold text-foreground tracking-tight">Showcase</span>
            </div>
            <p className="text-sm font-medium text-foreground/80 mb-2">
              Turn your experience into evidence.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Build a proof-of-work portfolio that shows recruiters exactly what you can do — not just what you claim.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 mb-4">Product</p>
            <ul className="space-y-2.5">
              {[
                { href: '/pricing', label: 'Pricing' },
                { href: '/login', label: 'Sign in' },
                { href: '/signup', label: 'Get started free' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 mb-4">Legal</p>
            <ul className="space-y-2.5">
              {[
                { href: '/terms', label: 'Terms of Service' },
                { href: '/privacy', label: 'Privacy Policy' },
                { href: '/refund', label: 'Refund Policy' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground/50">
            © {new Date().getFullYear()} Showcase. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground/40 italic">
            For professionals who show, not just tell.
          </p>
        </div>
      </div>
    </footer>
  )
}
