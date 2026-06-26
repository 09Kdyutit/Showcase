import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getRateLimiter } from '@/lib/rate-limit'

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

// Postgres-backed (or Upstash, if configured)  -  safe across multiple server instances,
// unlike a per-process in-memory Map which only protects whichever instance happens to
// receive the request.
const IP_LIMIT = 5
const IP_WINDOW_SECONDS = 60 * 60 // 1 hour

function generateToken(length = 24): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function generateReferralCode(email: string): string {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `${base}${rand}`
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'

    const rl = await getRateLimiter().check(`waitlist:${ip}`, IP_LIMIT, IP_WINDOW_SECONDS)
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

    // Honeypot check  -  silently succeed without inserting
    if (data.website_url_hidden) {
      return NextResponse.json({ success: true, message: "You're on the list!" })
    }

    const supabase = await createServiceClient()

    // Check if already exists
    const { data: existing } = await supabase
      .from('waitlist_signups')
      .select('id, referral_code, status')
      .eq('email', data.email)
      .single()

    if (existing) {
      // Update any newly provided optional fields
      const updatePayload: Record<string, unknown> = {}
      if (data.full_name && !existing) updatePayload.full_name = data.full_name
      if (data.target_role) updatePayload.target_role = data.target_role
      if (data.experience_level) updatePayload.experience_level = data.experience_level
      if (data.user_type) updatePayload.user_type = data.user_type
      if (data.biggest_challenge) updatePayload.biggest_challenge = data.biggest_challenge
      if (data.beta_goal) updatePayload.beta_goal = data.beta_goal

      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from('waitlist_signups')
          .update(updatePayload)
          .eq('id', existing.id)
      }

      return NextResponse.json({
        success: true,
        already_joined: true,
        referral_code: existing.referral_code,
        message: "You're already on the list! We'll email you when your invite is ready.",
      })
    }

    const referralCode = generateReferralCode(data.email)
    const inviteToken = generateToken(32)

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
      referral_code: data.referral_code ? undefined : referralCode,
      invite_token: inviteToken,
      status: 'waitlisted',
    })

    if (insertError) {
      // Handle race-condition duplicate
      if (insertError.code === '23505') {
        return NextResponse.json({
          success: true,
          already_joined: true,
          message: "You're already on the list! We'll email you when your invite is ready.",
        })
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

    return NextResponse.json({
      success: true,
      already_joined: false,
      referral_code: referralCode,
      message: "You're on the Showcase beta list!",
    })
  } catch (err) {
    console.error('Waitlist join error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
