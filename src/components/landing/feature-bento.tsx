import {
  ClipboardCheck,
  FileCheck2,
  Files,
  LayoutTemplate,
  MessagesSquare,
  Search,
  Sparkles,
} from 'lucide-react'

const GROUPS = [
  {
    label: 'Build',
    title: 'Make your experience easy to understand.',
    description: 'Start with your résumé. Turn it into a portfolio you can review, improve, and make your own.',
    tools: [
      {
        icon: LayoutTemplate,
        title: 'Portfolio Builder',
        description: 'Create an editable portfolio draft from your résumé, then adjust the copy, images, theme, and structure.',
      },
      {
        icon: ClipboardCheck,
        title: 'Evidence Audit',
        description: 'See where your story is strong and where it needs clearer details or results.',
      },
    ],
  },
  {
    label: 'Apply',
    title: 'Prepare for the role in front of you.',
    description: 'Reuse the experience you already reviewed instead of starting from a blank page for every application.',
    tools: [
      {
        icon: Search,
        title: 'Role Match',
        description: 'Compare a role with your documented experience. A match shows alignment, not hiring odds.',
      },
      {
        icon: Files,
        title: 'Application Kits',
        description: 'Draft a tailored résumé, cover letter, and outreach note. You review and send everything yourself.',
      },
      {
        icon: FileCheck2,
        title: 'ATS Checks',
        description: 'Catch common résumé content and formatting risks before you export and apply.',
      },
    ],
  },
  {
    label: 'Prepare',
    title: 'Turn your projects into interview stories.',
    description: 'Practice using the same experience that powers your portfolio and application materials.',
    tools: [
      {
        icon: MessagesSquare,
        title: 'Interview Practice',
        description: 'Practice written answers and get coaching that helps you make each answer clearer.',
      },
      {
        icon: Sparkles,
        title: 'Story Bank',
        description: 'Save useful examples from your experience so they are easier to recall and reuse.',
      },
    ],
  },
] as const

export function FeatureBento() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {GROUPS.map((group) => (
        <article key={group.label} className="glass-card flex h-full flex-col p-6 sm:p-7">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-300">{group.label}</p>
            <h3 className="mt-3 text-xl font-semibold leading-tight text-foreground">{group.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{group.description}</p>
          </div>

          <div className="mt-auto space-y-3">
            {group.tools.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-border bg-surface-100/70 p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-500/20 bg-brand-500/10 text-brand-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}
