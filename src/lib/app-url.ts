const FALLBACK_APP_URL = 'https://app.tryshowcase.ink'

export function configuredAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || FALLBACK_APP_URL).replace(/\/$/, '')
}

export function configuredAppHost(): string {
  try {
    return new URL(configuredAppUrl()).host
  } catch {
    return 'app.tryshowcase.ink'
  }
}
