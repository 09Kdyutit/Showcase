import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenAI } from '@google/genai'
import { COMPANIES } from '@/lib/interviews/companies'

export interface GeneratedCompanyData {
  name: string
  category: string
  interviewStyle: string
  keyFocus: string[]
  uniqueTips: string[]
  questions: { id: string; text: string; category: string; tip: string }[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const companyName = (body.companyName ?? '').trim()
    if (!companyName) return NextResponse.json({ error: 'Company name is required' }, { status: 400 })

    // Check curated list first (case-insensitive)
    const curated = COMPANIES.find((c) => c.name.toLowerCase() === companyName.toLowerCase())
    if (curated) {
      return NextResponse.json({
        data: {
          name: curated.name,
          category: curated.category,
          interviewStyle: curated.interviewStyle,
          keyFocus: curated.keyFocus,
          uniqueTips: curated.uniqueTips,
          questions: curated.questions,
          curated: true,
        },
      })
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_PRIVATE_DATA_ENABLED !== 'true') {
      return NextResponse.json({
        data: {
          name: companyName,
          category: 'Other',
          interviewStyle: `${companyName} uses behavioral interviews focused on your past experience and problem-solving approach. Expect STAR-format behavioral questions and role-specific technical assessment.`,
          keyFocus: [
            'Culture fit and team collaboration',
            'Relevant domain expertise for the role',
            'Problem-solving approach and communication',
            'Past impact and measurable outcomes',
            'Growth mindset and learning orientation',
          ],
          uniqueTips: [
            `Research ${companyName}'s mission, recent news, and product direction before your interview`,
            'Prepare 3-4 strong STAR stories you can adapt to different behavioral questions',
            'Know why you want to work at this company specifically -- generic answers fail',
            'Ask thoughtful questions about the team, product roadmap, and success metrics',
          ],
          questions: [
            { id: 'gen-001', text: `Why do you want to work at ${companyName} specifically?`, category: 'Motivation', tip: 'Be specific to this company -- their mission, product, or market position. Generic answers signal you applied everywhere.' },
            { id: 'gen-002', text: 'Tell me about the most impactful project you have worked on. What was your specific contribution?', category: 'Impact', tip: 'Lead with the outcome first, then explain what you did. Quantify the impact whenever possible.' },
            { id: 'gen-003', text: 'Describe a time you had to learn something new quickly to deliver on a deadline.', category: 'Adaptability', tip: 'Show the process of fast learning -- what you did, how you validated your understanding, and what you shipped.' },
            { id: 'gen-004', text: 'Tell me about a conflict with a colleague and how you resolved it.', category: 'Collaboration', tip: 'Show empathy AND resolution. Interviewers want to see you can navigate interpersonal friction constructively.' },
            { id: 'gen-005', text: 'Describe a failure and what you learned from it.', category: 'Self-Awareness', tip: 'Own the failure clearly. Companies penalize people who deflect or minimize -- they want to see real reflection and growth.' },
            { id: 'gen-006', text: 'How do you prioritize when you have more work than you can complete?', category: 'Prioritization', tip: 'Show a framework, not just instinct. Talk about stakeholder communication, impact vs effort, and explicit tradeoffs.' },
            { id: 'gen-007', text: 'Tell me about a time you had to influence someone without formal authority.', category: 'Influence', tip: 'Show you understand what motivates others. Lead with data, shared goals, and credibility -- not persistence.' },
            { id: 'gen-008', text: 'Where do you want to be in 3-5 years, and how does this role fit that path?', category: 'Career Goals', tip: 'Show ambition and self-awareness. Connect your growth trajectory to what you can contribute at this company.' },
          ],
          curated: false,
          generated: false,
        },
      })
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const prompt = [
      `You are an expert career coach and recruiter with deep knowledge of tech company interview processes.`,
      `Generate detailed, accurate interview preparation data for: ${companyName}`,
      '',
      'Based on what you know about this company (its culture, values, interview reputation, glassdoor feedback, and hiring patterns), generate:',
      '',
      'Respond ONLY with valid JSON, no markdown:',
      '{',
      '  "category": "FAANG" or "Growth" or "Enterprise" or "Startup" or "Finance" or "Healthcare" or "Agency" or "Other",',
      '  "interviewStyle": "<2-3 sentence description of how this company interviews, what format, what they value, any unique aspects of their process>",',
      '  "keyFocus": ["<5 specific things this company evaluates in interviews>"],',
      '  "uniqueTips": ["<4 non-obvious, company-specific tips that most candidates don\'t know>"],',
      '  "questions": [',
      '    {',
      '      "id": "gen-001",',
      '      "text": "<company-specific behavioral or situational question>",',
      '      "category": "<question category like Leadership/Culture/Technical/etc>",',
      '      "tip": "<1-2 sentence coaching tip specific to what this company wants to hear>"',
      '    }',
      '    // 8 questions total',
      '  ]',
      '}',
      '',
      'Be specific and accurate. If this is a well-known company, use real information about their interview process.',
      'For lesser-known companies, make reasonable inferences based on their industry, size, and culture.',
      'Do NOT be generic -- every data point should be specific to this company.',
    ].join('\n')

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const raw = response.text?.trim() ?? ''
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

    let parsed: Omit<GeneratedCompanyData, 'name'>
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[companies/prep] JSON parse failed for', companyName, raw.slice(0, 200))
      return NextResponse.json({ error: 'Could not generate prep data -- try again' }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        name: companyName,
        category: parsed.category ?? 'Other',
        interviewStyle: parsed.interviewStyle ?? '',
        keyFocus: parsed.keyFocus ?? [],
        uniqueTips: parsed.uniqueTips ?? [],
        questions: (parsed.questions ?? []).slice(0, 10).map((q, i) => ({
          ...q,
          id: q.id ?? `gen-${String(i + 1).padStart(3, '0')}`,
        })),
        curated: false,
        generated: true,
      },
    })
  } catch (err) {
    console.error('[companies/prep]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
