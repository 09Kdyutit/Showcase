import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const schema = z.object({
  email: z.string().email().optional(),
  invite_token: z.string().max(64).optional(),
  rating: z.number().int().min(1).max(10).optional(),
  product_stage: z.string().max(100).optional(),
  what_worked: z.string().max(2000).optional(),
  what_confused_you: z.string().max(2000).optional(),
  missing_features: z.string().max(2000).optional(),
  bugs: z.string().max(2000).optional(),
  would_recommend: z.boolean().optional(),
  published_portfolio: z.boolean().optional(),
  sent_to_recruiter: z.boolean().optional(),
  willingness_to_pay: z.string().max(500).optional(),
  testimonial_permission: z.boolean().default(false),
  followup_permission: z.boolean().default(false),
}).refine((d) => d.email || d.invite_token, {
  message: 'Either email or invite_token is required.',
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input.' },
        { status: 400 }
      )
    }

    const data = parsed.data
    const supabase = await createServiceClient()

    // Look up the waitlist_signup_id by invite_token or email
    let waitlistSignupId: string | null = null

    if (data.invite_token) {
      const { data: signup } = await supabase
        .from('waitlist_signups')
        .select('id')
        .eq('invite_token', data.invite_token)
        .single()
      waitlistSignupId = signup?.id ?? null
    } else if (data.email) {
      const { data: signup } = await supabase
        .from('waitlist_signups')
        .select('id')
        .eq('email', data.email)
        .single()
      waitlistSignupId = signup?.id ?? null
    }

    const { error: insertError } = await supabase.from('beta_feedback').insert({
      waitlist_signup_id: waitlistSignupId,
      email: data.email ?? null,
      invite_token: data.invite_token ?? null,
      rating: data.rating ?? null,
      product_stage: data.product_stage ?? null,
      what_worked: data.what_worked ?? null,
      what_confused_you: data.what_confused_you ?? null,
      missing_features: data.missing_features ?? null,
      bugs: data.bugs ?? null,
      would_recommend: data.would_recommend ?? null,
      published_portfolio: data.published_portfolio ?? null,
      sent_to_recruiter: data.sent_to_recruiter ?? null,
      willingness_to_pay: data.willingness_to_pay ?? null,
      testimonial_permission: data.testimonial_permission,
      followup_permission: data.followup_permission,
    })

    if (insertError) {
      console.error('Beta feedback insert error:', insertError.message)
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you - this directly shapes Showcase V1.',
    })
  } catch (err) {
    console.error('Beta feedback error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
