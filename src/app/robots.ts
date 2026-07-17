import type { MetadataRoute } from 'next'
import { configuredAppUrl } from '@/lib/app-url'

export default function robots(): MetadataRoute.Robots {
  const appUrl = configuredAppUrl()

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/resume-to-portfolio'],
      disallow: [
        '/api/',
        '/audit',
        '/billing',
        '/builder',
        '/callback',
        '/dashboard',
        '/demo/',
        '/interviews',
        '/jobs',
        '/join',
        '/login',
        '/onboarding',
        '/opportunities',
        '/projects',
        '/proof/',
        '/proofscore',
        '/resume',
        '/settings',
        '/shared/',
        '/signup',
        '/waitlist',
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  }
}
