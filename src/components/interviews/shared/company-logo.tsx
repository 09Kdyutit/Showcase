'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// Companies whose display name doesn't map cleanly to "name.com". Everything not
// listed here falls back to a slugified `<name>.com` guess, which is correct for the
// vast majority (stripe.com, figma.com, mckinsey.com, …). Any miss degrades gracefully
// to the gradient-initials avatar, so an unknown/typed company never looks broken.
const DOMAIN_OVERRIDES: Record<string, string> = {
  'meta': 'meta.com',
  'twitter / x': 'x.com',
  'x': 'x.com',
  'tiktok / bytedance': 'tiktok.com',
  'bytedance': 'bytedance.com',
  'block': 'block.xyz',
  'notion': 'notion.so',
  'hugging face': 'huggingface.co',
  'scale ai': 'scale.com',
  'boston consulting group': 'bcg.com',
  'bcg': 'bcg.com',
  'jpmorgan chase': 'jpmorganchase.com',
  'goldman sachs': 'goldmansachs.com',
  'morgan stanley': 'morganstanley.com',
  'johnson & johnson': 'jnj.com',
  'unitedhealth group': 'unitedhealthgroup.com',
  'cvs health': 'cvshealth.com',
  'warner bros discovery': 'wbd.com',
  'nbcuniversal': 'nbcuniversal.com',
  'best buy': 'bestbuy.com',
  'new relic': 'newrelic.com',
  'epic systems': 'epic.com',
  'veeva systems': 'veeva.com',
  'lucid motors': 'lucidmotors.com',
  'mistral': 'mistral.ai',
  'perplexity': 'perplexity.ai',
  'stability ai': 'stability.ai',
  'cohere': 'cohere.com',
  'railway': 'railway.app',
  'monday.com': 'monday.com',
  'general motors': 'gm.com',
}

const HUES = [210, 185, 145, 35, 270, 320, 60, 195]

export function companyDomain(name: string): string {
  const key = name.trim().toLowerCase()
  if (DOMAIN_OVERRIDES[key]) return DOMAIN_OVERRIDES[key]
  // Take the part before any "/" or "(", drop punctuation, collapse spaces.
  const slug = key
    .split(/[/(]/)[0]
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
    .trim()
  return slug ? `${slug}.com` : ''
}

function initials(name: string): string {
  return name
    .replace(/[/(].*$/, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function gradient(name: string): string {
  const h1 = HUES[name.charCodeAt(0) % HUES.length]
  const h2 = HUES[(name.charCodeAt(1) ?? 3) % HUES.length]
  return `linear-gradient(135deg, oklch(55% 0.2 ${h1}), oklch(50% 0.18 ${h2}))`
}

/**
 * Real company logo on a clean white tile, with a gradient-initials fallback when no
 * logo can be resolved (unknown company, network failure, or no brand logo on file).
 * `className` controls the tile's size/shape/shadow; `textClass` sizes the fallback initials.
 */
export function CompanyLogo({
  name,
  className,
  textClass = 'text-xs',
}: {
  name: string
  className?: string
  textClass?: string
}) {
  const [failed, setFailed] = useState(false)
  const domain = companyDomain(name)

  if (failed || !domain) {
    return (
      <div
        className={cn('flex items-center justify-center font-bold text-white shrink-0', textClass, className)}
        style={{ background: gradient(name) }}
        aria-label={name}
      >
        {initials(name)}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center overflow-hidden bg-white shrink-0', className)}>
      {/* unavatar aggregates Clearbit/Google/DuckDuckGo and returns the best available logo;
          fallback=false makes it error for unknown companies so the gradient-initials
          fallback below takes over instead of showing a generic placeholder. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://unavatar.io/${domain}?fallback=false`}
        alt={`${name} logo`}
        loading="lazy"
        className="w-[72%] h-[72%] object-contain"
        onError={() => setFailed(true)}
        draggable={false}
      />
    </div>
  )
}
