import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getRateLimiter } from '@/lib/rate-limit'
import { Resend } from 'resend'
import { waitlistConfirmationEmail } from '@/lib/email/waitlist-email'
import { isEmailSuppressed } from '@/lib/email/suppressions'
import { generateAdmissionToken, generateWaitlistReferralCode } from '@/lib/growth/admission'
import { clientFingerprint } from '@/lib/proofscore/capacity'

const resend = new Resend(process.env.RESEND_API_KEY)

const schema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase(),
  full_name: z.string().max(120).optional(),
  target_role: z.string().max(120).optional(),
  experience_level: z.enum(['student', 'new_grad', 'early', 'mid', 'switcher', 'freelancer']).optional(),
  user_type: z.enum(['internship', 'job_search', 'freelance', 'career_switch', 'personal_brand']).optional(),
  biggest_challenge: z.string().max(200).optional(),
  beta_goal: z.string().max(500).optional(),
  current_portfolio_url: z.string().url().optional().or(z.literal('')),
  source: z.string().max(120).optional(),
  referrer: z.string().max(512).optional(),
  utm_source: z.string().max(120).optional(),
  utm_medium: z.string().max(120).optional(),
  utm_campaign: z.string().max(120).optional(),
  utm_content: z.string().max(120).optional(),
  referral_code: z.string().max(32).optional(),
  // honeypot
  website_url_hidden: z.string().optional(),
  consent: z.boolean().refine((v) => v === true, { message: 'You must agree to receive updates.' }),
})

// Postgres-backed (or Upstash, if configured) - safe across multiple server instances,
// unlike a per-process in-memory Map which only protects whichever instance happens to
// receive the request.
const IP_LIMIT = 5
const IP_WINDOW_SECONDS = 60 * 60 // 1 hour
const CONSENT_VERSION = 'waitlist-v1'
const PUBLIC_SUCCESS_MESSAGE = 'Thanks. If this address is on our list, its spot is saved.'

function publicSuccessResponse() {
  // Keep this response identical for new and existing addresses. Referral codes and
  // membership state are sent only through email/account-owned surfaces, never disclosed
  // to an unauthenticated caller that merely knows an address.
  return NextResponse.json({ success: true, message: PUBLIC_SUCCESS_MESSAGE })
}

export async function POST(req: NextRequest) {
  try {
    const fingerprint = clientFingerprint(req)

    let rl
    try {
      rl = await getRateLimiter().check(
        `waitlist:${fingerprint}`,
        IP_LIMIT,
        IP_WINDOW_SECONDS,
        { failOpen: false },
      )
    } catch (error) {
      console.error('[waitlist] strict rate limit unavailable:', error instanceof Error ? error.message : error)
      return NextResponse.json(
        { error: 'Waitlist signup is temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      )
    }
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input.' },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Honeypot check - silently succeed without inserting
    if (data.website_url_hidden) {
      return publicSuccessResponse()
    }

    const supabase = await createServiceClient()

    // Check if already exists
    const { data: existing, error: existingError } = await supabase
      .from('waitlist_signups')
      .select('id')
      .eq('email', data.email)
      .maybeSingle()
    if (existingError) throw existingError

    if (existing) {
      // Email ownership has not been proven. Never mutate the existing person's answers or
      // consent based on this public request, and never reveal that the row exists.
      return publicSuccessResponse()
    }

    // Provider complaints and bounces are server-owned. Joining may still preserve the
    // person's place, but must never cause another message to a suppressed address.
    const emailSuppressed = await isEmailSuppressed(supabase, data.email)
    const referralCode = generateWaitlistReferralCode()
    const inviteToken = generateAdmissionToken()
    let referredBySignupId: string | null = null
    if (data.referral_code) {
      const { data: referrerSignup } = await supabase
        .from('waitlist_signups')
        .select('id')
        .eq('referral_code', data.referral_code.trim().toUpperCase())
        .maybeSingle()
      referredBySignupId = referrerSignup?.id ?? null
    }

    const { error: insertError } = await supabase.from('waitlist_signups').insert({
      email: data.email,
      full_name: data.full_name ?? null,
      target_role: data.target_role ?? null,
      experience_level: data.experience_level ?? null,
      user_type: data.user_type ?? null,
      biggest_challenge: data.biggest_challenge ?? null,
      beta_goal: data.beta_goal ?? null,
      current_portfolio_url: data.current_portfolio_url || null,
      source: data.source ?? null,
      referrer: data.referrer ?? null,
      utm_source: data.utm_source ?? null,
      utm_medium: data.utm_medium ?? null,
      utm_campaign: data.utm_campaign ?? null,
      utm_content: data.utm_content ?? null,
      referral_code: referralCode,
      referred_by_signup_id: referredBySignupId,
      invite_token: inviteToken,
      consent_granted_at: new Date().toISOString(),
      consent_version: CONSENT_VERSION,
      status: 'waitlisted',
    })

    if (insertError) {
      // Handle race-condition duplicate
      if (insertError.code === '23505') {
        const { data: racedExisting } = await supabase
          .from('waitlist_signups')
          .select('id')
          .eq('email', data.email)
          .maybeSingle()
        if (!racedExisting) {
          console.error('Waitlist unique collision:', insertError.message)
          return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
        }
        return publicSuccessResponse()
      }
      const isTableMissing = insertError.code === 'PGRST205' || insertError.message?.includes('waitlist_signups')
      console.error('Waitlist insert error:', insertError.code, insertError.message)
      if (process.env.NODE_ENV === 'development' && isTableMissing) {
        return NextResponse.json(
          { error: 'Database table missing. Run the migration: paste supabase/migrations/002_waitlist.sql into the Supabase SQL Editor.' },
          { status: 500 }
        )
      }
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      )
    }

    // Send confirmation email. Must be awaited - Vercel can freeze the serverless
    // function the instant a response is returned, so an un-awaited send can get cut
    // off before the request to Resend ever completes.
    if (!emailSuppressed && process.env.EMAILS_ENABLED === 'true') {
      const { subject, html, text } = waitlistConfirmationEmail(data.full_name, process.env.EMAIL_POSTAL_ADDRESS)
      try {
        const response = await resend.emails.send({
          from: 'Showcase <hello@tryshowcase.ink>',
          to: data.email,
          subject,
          html,
          text,
          tags: [{ name: 'type', value: 'waitlist_confirmation' }],
        })
        if (response.error) throw new Error(response.error.message)
      } catch (err) {
        console.error('Resend error:', err)
      }
    }

    return publicSuccessResponse()
  } catch (err) {
    console.error('Waitlist join error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
