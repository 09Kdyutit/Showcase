// Shared between onboarding (collects this) and the portfolio builder (uses it to
// influence generation tone/positioning) — one canonical mapping so they can't drift.
export const PORTFOLIO_GOALS = [
  { value: 'job_search', label: 'Active job search' },
  { value: 'freelance', label: 'Win freelance clients' },
  { value: 'promotion', label: 'Get promoted internally' },
  { value: 'career_change', label: 'Career change' },
  { value: 'personal', label: 'Personal brand' },
] as const

export function portfolioGoalLabel(value: string | null | undefined): string {
  return PORTFOLIO_GOALS.find((g) => g.value === value)?.label ?? 'Active job search'
}
