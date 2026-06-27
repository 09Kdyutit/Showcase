import * as cheerio from 'cheerio'

export interface ExtractedJob {
  description: string
  title: string | null
  company: string | null
}

const MIN_USABLE_LENGTH = 200

function htmlToPlainText(html: string): string {
  // Insert line breaks at block boundaries before stripping tags, otherwise adjacent
  // <p>/<li> elements collapse into one run-on sentence with no separating space.
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n</$1>')
  const $ = cheerio.load(`<div>${withBreaks}</div>`)
  return $('div')
    .text()
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** schema.org JobPosting JSON-LD — the most reliable source; output by Greenhouse,
 * Lever, Workday, and most ATS platforms that want Google for Jobs indexing. */
function extractFromJsonLd($: cheerio.CheerioAPI): ExtractedJob | null {
  const scripts = $('script[type="application/ld+json"]')
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).text()
    if (!raw?.trim()) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed]
    for (const node of candidates) {
      const graph = (node as { '@graph'?: unknown[] })?.['@graph']
      const items = Array.isArray(graph) ? [...candidates, ...graph] : candidates
      for (const item of items) {
        const obj = item as Record<string, unknown>
        const type = obj?.['@type']
        const isJobPosting = type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))
        if (!isJobPosting) continue
        const rawDescription = obj.description
        if (typeof rawDescription !== 'string') continue
        const description = htmlToPlainText(rawDescription)
        if (description.length < MIN_USABLE_LENGTH) continue

        const title = typeof obj.title === 'string' ? obj.title : null
        const hiringOrg = obj.hiringOrganization as { name?: string } | undefined
        const company = typeof hiringOrg?.name === 'string' ? hiringOrg.name : null

        return { description, title, company }
      }
    }
  }
  return null
}

/** Fallback when there's no JobPosting JSON-LD: strip boilerplate chrome and take
 * the largest remaining text block, which is almost always the job body. */
function extractByHeuristic($: cheerio.CheerioAPI): ExtractedJob | null {
  $('script, style, noscript, svg, nav, header, footer, iframe').remove()
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove()

  const candidateSelectors = [
    'main',
    'article',
    '[class*="job-description" i]',
    '[class*="jobDescription" i]',
    '[id*="job-description" i]',
    '[class*="posting" i]',
    '[class*="description" i]',
  ]

  let best = ''
  for (const selector of candidateSelectors) {
    $(selector).each((_, el) => {
      const text = $(el).text().trim()
      if (text.length > best.length) best = text
    })
    if (best.length >= MIN_USABLE_LENGTH * 3) break
  }

  if (best.length < MIN_USABLE_LENGTH) {
    const bodyText = $('body').text()
    if (bodyText.trim().length >= MIN_USABLE_LENGTH) best = bodyText
  }

  const description = best
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (description.length < MIN_USABLE_LENGTH) return null

  const title = $('title').first().text().trim().split(/[|\-–—]/)[0]?.trim() || null
  return { description, title, company: null }
}

export function extractJobFromHtml(html: string): ExtractedJob | null {
  const $ = cheerio.load(html)
  return extractFromJsonLd($) ?? extractByHeuristic($)
}
