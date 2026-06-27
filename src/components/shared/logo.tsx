import Image from 'next/image'
import { cn } from '@/lib/utils'

// Single source of truth for the brand mark - was previously copy-pasted as a
// hardcoded gradient box + "S" placeholder in 7+ separate files (sidebar x2, navbar,
// footer, login, signup). The icon is a real raster asset (public/logo-icon.png,
// transparent background, processed from the actual brand logo); the wordmark stays
// real text with a CSS gradient rather than baked into the image, so it stays sharp
// at any size, is selectable/accessible, and adapts to light/dark surfaces.

const ICON_SIZE: Record<'sm' | 'md' | 'lg', number> = { sm: 22, md: 28, lg: 40 }
const TEXT_SIZE: Record<'sm' | 'md' | 'lg', string> = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' }

export function Logo({
  size = 'md',
  showWordmark = true,
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
  className?: string
}) {
  const px = ICON_SIZE[size]
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {/* Decorative: every real usage of this component pairs the icon with adjacent
          text that already names "Showcase" (the wordmark below, or surrounding copy
          like "Built with Showcase") - a non-empty alt here would make screen readers
          announce the name twice. Found by axe-core flagging image-redundant-alt. */}
      <Image
        src="/logo-icon.png"
        alt=""
        width={px}
        height={px}
        className="shrink-0 select-none"
        priority
      />
      {showWordmark && (
        <span
          className={cn(
            'font-bold tracking-tight bg-gradient-to-r from-brand-600 to-brand-800 bg-clip-text text-transparent',
            TEXT_SIZE[size]
          )}
        >
          Showcase
        </span>
      )}
    </span>
  )
}
