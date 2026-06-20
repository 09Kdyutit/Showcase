import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractPdfViaVision } from '@/lib/ai/pdf-vision'

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

    // Magic-byte check — the declared MIME type and filename extension are both
    // attacker-controlled. A renamed .exe claiming to be "resume.pdf" must be rejected
    // before it ever reaches a parser, regardless of what the client says it is.
    const isPdfSignature = buffer.length >= 4 && buffer.subarray(0, 4).toString('latin1') === '%PDF'
    // DOCX is a zip container — real zip files start with 'PK' (0x50 0x4B).
    const isZipSignature = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b
    if (isPdf && !isPdfSignature) {
      return NextResponse.json({ error: 'This file is not a valid PDF.' }, { status: 400 })
    }
    if (isDocx && !isZipSignature) {
      return NextResponse.json({ error: 'This file is not a valid DOCX.' }, { status: 400 })
    }

    let text = ''

    // Parsers run on attacker-controlled bytes (zip bombs, deeply nested structures can
    // hang or balloon memory) — bound how long we'll wait regardless of file content.
    const PARSE_TIMEOUT_MS = 15_000
    function withTimeout<T>(promise: Promise<T>): Promise<T> {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('parse_timeout')), PARSE_TIMEOUT_MS)),
      ])
    }

    let usedVisionFallback = false

    if (isPdf) {
      try {
        const { PDFParse } = await import('pdf-parse')
        const parser = new PDFParse({ data: buffer })
        try {
          const result = await withTimeout(parser.getText())
          // Strip pdf-parse's "-- N of M --" page-separator footers — noise, not resume content
          text = result.text.replace(/^--\s*\d+\s*of\s*\d+\s*--$/gm, '')
        } finally {
          await parser.destroy()
        }
      } catch (parseErr) {
        // pdf-parse threw outright (corrupted structure, unsupported encoding, etc.) —
        // don't give up yet, fall through to the vision fallback below.
        console.error('[resume/extract-text] pdf-parse threw, will try vision fallback:', parseErr instanceof Error ? parseErr.message : parseErr)
        text = ''
      }

      // Standard text extraction failed or returned near-nothing — most commonly a
      // scanned/photographed resume, or a PDF exported with outlined fonts that have no
      // real text layer at all. A vision-capable model can still read it as an image.
      if (text.replace(/\n{3,}/g, '\n\n').trim().length < 50) {
        try {
          const visionText = await withTimeout(extractPdfViaVision(buffer))
          if (visionText.length >= 50) {
            text = visionText
            usedVisionFallback = true
          }
        } catch (visionErr) {
          console.error('[resume/extract-text] vision fallback also failed:', visionErr instanceof Error ? visionErr.message : visionErr)
        }
      }
    } else if (isDocx) {
      const mammoth = await import('mammoth')
      const result = await withTimeout(mammoth.extractRawText({ buffer }))
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
          message: isPdf
            ? 'This PDF appears to have no readable text or image content (it may be empty or corrupted) — try pasting the text manually instead.'
            : 'Could not extract enough text from this file. Try pasting the text manually instead.',
        },
        { status: 422 }
      )
    }

    return NextResponse.json({ data: { text, extraction_method: usedVisionFallback ? 'vision' : 'text' } })
  } catch (err) {
    console.error('[resume/extract-text]', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json(
      { error: 'Could not read this file. Try pasting the text manually instead.' },
      { status: 500 }
    )
  }
}
