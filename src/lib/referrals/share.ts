export function buildReferralUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, '')}/signup?ref=${encodeURIComponent(code)}`
}

export function buildReferralMessage(url: string): string {
  return `I’ve been using Showcase to turn my resume into an editable portfolio, tailor application materials, and practice interviews in one workspace. I have one of my three invites for you—it skips the waitlist and starts you with +5 AI credits: ${url}`
}
