// Shared between onboarding (collects this) and the portfolio builder (uses it to
// influence generation tone/positioning) - one canonical mapping so they can't drift.
export const PORTFOLIO_GOALS = [
  { value: 'job_search', label: 'Active job search' },
  { value: 'freelance', label: 'Win freelance clients' },
  { value: 'promotion', label: 'Get promoted internally' },
  { value: 'career_change', label: 'Career change' },
  { value: 'personal', label: 'Personal brand' },
] as const

// Resume Studio edits an existing structured resume. File/paste intake lives in
// onboarding, so recovery CTAs must use this route instead of sending a user to
// an editor that cannot perform the upload they were promised.
export const RESUME_INTAKE_PATH = '/onboarding?intent=resume'

export function resumeIntakePath(returnTo: string): string {
  return `${RESUME_INTAKE_PATH}&returnTo=${encodeURIComponent(returnTo)}`
}

const RESUME_RETURN_ROOTS = ['/dashboard', '/resume', '/builder', '/audit', '/projects', '/jobs', '/opportunities']

export function safeResumeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard'
  return RESUME_RETURN_ROOTS.some((root) => value === root || value.startsWith(`${root}/`) || value.startsWith(`${root}?`))
    ? value
    : '/dashboard'
}

export function portfolioGoalLabel(value: string | null | undefined): string {
  return PORTFOLIO_GOALS.find((g) => g.value === value)?.label ?? 'Active job search'
}
