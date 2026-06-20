// Provider-neutral: works with zero configuration (structured console logging, which
// every host — Vercel included — captures and makes searchable), and optionally also
// forwards to ERROR_WEBHOOK_URL if set. That env var can point at literally anything
// that accepts a JSON POST: a Slack incoming webhook for now, or later a real Sentry
// project's ingestion endpoint, without changing this file or adding an SDK dependency
// the project doesn't have yet.

const SECRET_PATTERNS = [
  /sk_(live|test)_[a-zA-Z0-9]+/g,
  /pk_(live|test)_[a-zA-Z0-9]+/g,
  /whsec_[a-zA-Z0-9]+/g,
  /sb_secret_[a-zA-Z0-9_]+/g,
  /Bearer\s+[a-zA-Z0-9._-]+/g,
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, // JWT-shaped
]

export function redact(input: string): string {
  let out = input
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]')
  }
  return out
}

interface ErrorContext {
  routePath?: string
  routeType?: string
  method?: string
  requestId?: string
  [key: string]: unknown
}

export async function captureError(error: Error, context: ErrorContext = {}): Promise<void> {
  const payload = {
    message: redact(error.message),
    stack: error.stack ? redact(error.stack) : undefined,
    digest: (error as Error & { digest?: string }).digest,
    context,
    timestamp: new Date().toISOString(),
  }

  // Always logs — zero config, captured by any host's log viewer.
  console.error('[error-reporter]', JSON.stringify(payload))

  const webhookUrl = process.env.ERROR_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
  } catch (webhookErr) {
    // Never let a failing observability sink mask or throw over the original error.
    console.error('[error-reporter] webhook delivery failed:', webhookErr instanceof Error ? webhookErr.message : webhookErr)
  }
}
