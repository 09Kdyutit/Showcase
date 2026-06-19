import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4MB — stays under typical serverless body limits

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File is too large. Max 4MB.' }, { status: 400 })
    }

    const name = file instanceof File ? file.name : ''
    const type = file.type
    const isPdf = type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')
    const isDocx =
      type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      name.toLowerCase().endsWith('.docx')
    const isTxt = type === 'text/plain' || name.toLowerCase().endsWith('.txt')

    const buffer = Buffer.from(await file.arrayBuffer())
    let text = ''

    if (isPdf) {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: buffer })
      try {
        const result = await parser.getText()
        // Strip pdf-parse's "-- N of M --" page-separator footers — noise, not resume content
        text = result.text.replace(/^--\s*\d+\s*of\s*\d+\s*--$/gm, '')
      } finally {
        await parser.destroy()
      }
    } else if (isDocx) {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else if (isTxt) {
      text = buffer.toString('utf-8')
    } else {
      return NextResponse.json({ error: 'Only PDF, DOCX, or TXT files are supported' }, { status: 400 })
    }

    text = text.replace(/\n{3,}/g, '\n\n').trim()

    if (text.length < 50) {
      return NextResponse.json(
        {
          error: 'extraction_too_short',
          message: 'Could not extract enough text from this file. It may be a scanned image PDF — try pasting the text manually instead.',
        },
        { status: 422 }
      )
    }

    return NextResponse.json({ data: { text } })
  } catch (err) {
    console.error('[resume/extract-text]', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json(
      { error: 'Could not read this file. Try pasting the text manually instead.' },
      { status: 500 }
    )
  }
}
