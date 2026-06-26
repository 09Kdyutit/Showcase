import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { questionText, answerText } = body as { questionText?: string; answerText?: string }

    if (!questionText?.trim()) return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    if (!answerText?.trim() || answerText.trim().length < 30) {
      return NextResponse.json({ error: 'Answer must be at least 30 characters' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_PRIVATE_DATA_ENABLED !== 'true') {
      return NextResponse.json({
        data: {
          clarity: 17, action: 15, impact: 12, structure: 16, total: 60,
          label: 'Good',
          strengths: ['Answer is structured and clear'],
          improvements: ['Add specific numbers or metrics to your result', 'Clarify what your exact role was vs the team'],
        },
      })
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const prompt = [
      'You are an expert interview coach scoring a behavioral interview answer.',
      '',
      `Question: ${questionText.trim()}`,
      `Candidate Answer: ${answerText.trim()}`,
      '',
      'Score this answer on 4 dimensions, each worth 0-25 points (total 0-100):',
      '1. Clarity & Context (0-25): Does the candidate clearly establish who they were, what the situation was, and their specific role in it?',
      '2. Action Specificity (0-25): Does the candidate describe their OWN concrete actions in specific detail -- not vague or team-level?',
      '3. Measurable Impact (0-25): Is there a concrete result, outcome, or learning that demonstrates real-world effect?',
      '4. STAR Structure (0-25): Does the answer follow a coherent Situation to Task to Action to Result flow?',
      '',
      'Be honest and rigorous. A "10/25" means mediocre, not failing. Reserve 23-25 for genuinely excellent answers.',
      '',
      'Respond ONLY with valid JSON, no markdown fences:',
      '{',
      '  "clarity": <number 0-25>,',
      '  "action": <number 0-25>,',
      '  "impact": <number 0-25>,',
      '  "structure": <number 0-25>,',
      '  "strengths": ["<specific thing done well>", "<second strength if present>"],',
      '  "improvements": ["<most important gap to address>", "<second most important>"]',
      '}',
    ].join('\n')

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const raw = response.text?.trim() ?? ''
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

    let parsed: { clarity: number; action: number; impact: number; structure: number; strengths: string[]; improvements: string[] }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[questions/score] Failed to parse Gemini response:', raw.slice(0, 200))
      return NextResponse.json({ error: 'Scoring failed -- try again' }, { status: 500 })
    }

    const total = (parsed.clarity ?? 0) + (parsed.action ?? 0) + (parsed.impact ?? 0) + (parsed.structure ?? 0)
    const label =
      total >= 90 ? 'Excellent' :
      total >= 75 ? 'Good' :
      total >= 55 ? 'Fair' :
      'Needs Work'

    return NextResponse.json({
      data: {
        clarity: parsed.clarity,
        action: parsed.action,
        impact: parsed.impact,
        structure: parsed.structure,
        total,
        label,
        strengths: parsed.strengths ?? [],
        improvements: parsed.improvements ?? [],
      },
    })
  } catch (err) {
    console.error('[questions/score]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
