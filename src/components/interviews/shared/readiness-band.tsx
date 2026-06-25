import { Badge } from '@/components/ui/badge'
import type { ReadinessBand } from '@/lib/interviews/schemas'

const BAND_CONFIG: Record<ReadinessBand, { label: string; variant: 'warning' | 'info' | 'success' }> = {
  starting: { label: 'Starting', variant: 'warning' },
  building: { label: 'Building', variant: 'warning' },
  practicing: { label: 'Practicing', variant: 'info' },
  interview_ready: { label: 'Interview Ready', variant: 'success' },
  strong: { label: 'Strong', variant: 'success' },
}

export function ReadinessBandBadge({ band }: { band: ReadinessBand }) {
  const config = BAND_CONFIG[band]
  return <Badge variant={config.variant}>{config.label}</Badge>
}

export const READINESS_BAND_LABELS: Record<ReadinessBand, string> = Object.fromEntries(
  Object.entries(BAND_CONFIG).map(([k, v]) => [k, v.label])
) as Record<ReadinessBand, string>
