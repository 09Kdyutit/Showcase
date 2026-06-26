import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenAI } from '@google/genai'

interface ProjectSuggestion {
  title: string
  tagline: string
  why: string
  techStack: string[]
  difficulty: 'Weekend' | '1-2 Weeks' | '1 Month'
  impact: string
  steps: string[]
  repoIdea: string
}

const MOCK_SUGGESTIONS: ProjectSuggestion[] = [
  {
    title: 'Real-Time Collaboration API',
    tagline: 'A WebSocket-powered system for live multi-user document editing',
    why: 'Your resume shows strong backend skills but no real-time or distributed systems experience. Adding this closes a major gap that appears in ~70% of senior engineering job descriptions.',
    techStack: ['Node.js', 'WebSockets', 'Redis', 'TypeScript'],
    difficulty: '1-2 Weeks',
    impact: 'Demonstrates systems design, concurrency handling, and real-world architectural thinking that employers specifically look for',
    steps: [
      'Design the WebSocket message protocol (join room, broadcast, presence)',
      'Implement Redis pub/sub for horizontal scaling across server instances',
      'Add conflict resolution logic (last-write-wins or operational transforms)',
      'Build a simple React demo that shows live cursor positions',
      'Deploy to Railway or Fly.io and document the architecture decisions',
    ],
    repoIdea: 'collab-engine -- Scalable real-time collaboration server with Redis pub/sub',
  },
  {
    title: 'CLI Dev Tool with Plugin Architecture',
    tagline: 'An extensible command-line tool that solves a real developer pain point',
    why: 'Developer tools experience is extremely valuable and rare. Building a CLI with a plugin system shows architectural maturity and the kind of "tools for builders" thinking that stands out in portfolios.',
    techStack: ['TypeScript', 'Node.js', 'Commander.js', 'npm'],
    difficulty: '1-2 Weeks',
    impact: 'Open source developer tooling gets noticed. A good CLI with real users is worth more than 10 tutorial projects',
    steps: [
      'Identify a real pain point in your own workflow (code scaffolding, API mocking, log parsing)',
      'Design the plugin interface that third-party devs could implement',
      'Build the core CLI with Commander.js and TypeScript',
      'Create 2-3 example plugins that ship with the tool',
      'Publish to npm and write a proper README with usage examples',
    ],
    repoIdea: 'devkit-cli -- Extensible developer CLI with plugin architecture',
  },
]

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { resumeText, resumeId } = body as { resumeText?: string; resumeId?: string }

    let content = resumeText?.trim() ?? ''

    if (!content && resumeId) {
      const { data: resume } = await supabase
        .from('resumes')
        .select('content, raw_text')
        .eq('id', resumeId)
        .eq('user_id', user.id)
        .single()

      if (resume) {
        content = resume.raw_text ?? JSON.stringify(resume.content) ?? ''
      }
    }

    if (!content || content.length < 50) {
      return NextResponse.json({ error: 'Resume content is required' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_PRIVATE_DATA_ENABLED !== 'true') {
      return NextResponse.json({ data: { suggestions: MOCK_SUGGESTIONS } })
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const prompt = [
      'You are a senior engineering career advisor who helps candidates build portfolios that get them hired.',
      '',
      'Analyze this resume and suggest exactly 6 specific projects that would MEANINGFULLY strengthen it.',
      'Base your suggestions on actual gaps, missing signals, and opportunities specific to THIS person\'s background.',
      'Do NOT suggest generic tutorial projects. Each suggestion must be custom-tailored to the resume.',
      '',
      'Resume:',
      content.slice(0, 8000),
      '',
      'For each project, consider:',
      '- What skills are MISSING or underrepresented that top employers look for at this person\'s level',
      '- What would make their GitHub/portfolio stand out for their target roles',
      '- Projects that demonstrate leadership, system design, or real-world impact',
      '- Mix of difficulty levels: some quick wins (Weekend), some substantial (1 Month)',
      '',
      'Respond with ONLY a valid JSON array of exactly 6 projects. No markdown, no preamble:',
      '[',
      '  {',
      '    "title": "<specific project name, not generic>",',
      '    "tagline": "<one sentence of what it does>",',
      '    "why": "<2-3 sentences on why THIS specific person needs this based on their resume gaps>",',
      '    "techStack": ["tech1", "tech2", "tech3"],',
      '    "difficulty": "Weekend" or "1-2 Weeks" or "1 Month",',
      '    "impact": "<what this adds to their story for their target roles>",',
      '    "steps": ["step1", "step2", "step3", "step4", "step5"],',
      '    "repoIdea": "<suggested repo name and one-line description>"',
      '  }',
      ']',
    ].join('\n')

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const raw = response.text?.trim() ?? ''
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

    let suggestions: ProjectSuggestion[]
    try {
      suggestions = JSON.parse(jsonStr)
      if (!Array.isArray(suggestions) || suggestions.length === 0) throw new Error('invalid array')
    } catch {
      console.error('[suggest-projects] JSON parse failed:', raw.slice(0, 300))
      return NextResponse.json({ error: 'AI response was malformed -- try again' }, { status: 500 })
    }

    return NextResponse.json({ data: { suggestions: suggestions.slice(0, 6) } })
  } catch (err) {
    console.error('[suggest-projects]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
