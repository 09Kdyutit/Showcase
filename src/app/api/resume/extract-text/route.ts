import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractPdfViaVision, isGarbledPdfText } from '@/lib/ai/pdf-vision'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { trackAsync } from '@/lib/analytics/track'
import { isGeminiEnabled } from '@/lib/feature-flags'

const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4MB - stays under typical serverless body limits

// pdfjs-dist expects the browser DOMMatrix global. In local Node it arrives via an
// optional native canvas package; on Vercel's runtime that package is absent, so without
// this the pdf-parse import throws "DOMMatrix is not defined" and every PDF upload dies
// (2026-07-14 production incident). Text extraction never rasterizes a page, so a correct
// 2D-affine subset is all pdfjs touches. No-op wherever a real DOMMatrix exists.
function installDomMatrixPolyfill(): void {
  const g = globalThis as { DOMMatrix?: unknown }
  if (typeof g.DOMMatrix !== 'undefined') return
  class DOMMatrixPolyfill {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    constructor(init?: number[] | DOMMatrixPolyfill) {
      if (Array.isArray(init) && init.length >= 6) {
        ;[this.a, this.b, this.c, this.d, this.e, this.f] = init
      } else if (init && typeof init === 'object') {
        const m = init as DOMMatrixPolyfill
        this.a = m.a; this.b = m.b; this.c = m.c; this.d = m.d; this.e = m.e; this.f = m.f
      }
    }
    get is2D() { return true }
    get isIdentity() { return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0 }
    private _mul(o: DOMMatrixPolyfill): DOMMatrixPolyfill {
      return new DOMMatrixPolyfill([
        o.a * this.a + o.b * this.c, o.a * this.b + o.b * this.d,
        o.c * this.a + o.d * this.c, o.c * this.b + o.d * this.d,
        o.e * this.a + o.f * this.c + this.e, o.e * this.b + o.f * this.d + this.f,
      ])
    }
    multiply(o: DOMMatrixPolyfill) { return this._mul(o) }
    multiplySelf(o: DOMMatrixPolyfill) { const r = this._mul(o); Object.assign(this, r); return this }
    preMultiplySelf(o: DOMMatrixPolyfill) { const r = o._mul(this); Object.assign(this, r); return this }
    translate(tx = 0, ty = 0) { return this._mul(new DOMMatrixPolyfill([1, 0, 0, 1, tx, ty])) }
    translateSelf(tx = 0, ty = 0) { return this.multiplySelf(new DOMMatrixPolyfill([1, 0, 0, 1, tx, ty])) }
    scale(sx = 1, sy?: number) { return this._mul(new DOMMatrixPolyfill([sx, 0, 0, sy ?? sx, 0, 0])) }
    scaleSelf(sx = 1, sy?: number) { return this.multiplySelf(new DOMMatrixPolyfill([sx, 0, 0, sy ?? sx, 0, 0])) }
    rotate(deg = 0) { const r = (deg * Math.PI) / 180; return this._mul(new DOMMatrixPolyfill([Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0])) }
    invertSelf() {
      const det = this.a * this.d - this.b * this.c
      if (det === 0) { this.a = this.b = this.c = this.d = this.e = this.f = NaN; return this }
      const { a, b, c, d, e, f } = this
      this.a = d / det; this.b = -b / det; this.c = -c / det; this.d = a / det
      this.e = (c * f - d * e) / det; this.f = (b * e - a * f) / det
      return this
    }
    inverse() { return new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e, this.f]).invertSelf() }
    transformPoint(p: { x?: number; y?: number } = {}) {
      const x = p.x ?? 0, y = p.y ?? 0
      return { x: this.a * x + this.c * y + this.e, y: this.b * x + this.d * y + this.f, z: 0, w: 1 }
    }
    toFloat32Array() { return new Float32Array([this.a, this.b, 0, 0, this.c, this.d, 0, 0, 0, 0, 1, 0, this.e, this.f, 0, 1]) }
    toFloat64Array() { return new Float64Array(this.toFloat32Array()) }
  }
  g.DOMMatrix = DOMMatrixPolyfill
}

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

    // Magic-byte check - the declared MIME type and filename extension are both
    // attacker-controlled. A renamed .exe claiming to be "resume.pdf" must be rejected
    // before it ever reaches a parser, regardless of what the client says it is.
    const isPdfSignature = buffer.length >= 4 && buffer.subarray(0, 4).toString('latin1') === '%PDF'
    // DOCX is a zip container - real zip files start with 'PK' (0x50 0x4B).
    const isZipSignature = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b
    if (isPdf && !isPdfSignature) {
      return NextResponse.json({ error: 'This file is not a valid PDF.' }, { status: 400 })
    }
    if (isDocx && !isZipSignature) {
      return NextResponse.json({ error: 'This file is not a valid DOCX.' }, { status: 400 })
    }

    let text = ''

    // Parsers run on attacker-controlled bytes (zip bombs, deeply nested structures can
    // hang or balloon memory) - bound how long we'll wait regardless of file content.
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
        // pdfjs-dist (inside pdf-parse) references the browser DOMMatrix API at module
        // load. Local Node gets it from an optional native canvas package that never
        // installs on Vercel's serverless runtime, so production imports crashed with
        // "DOMMatrix is not defined" and every PDF upload silently died (2026-07-14
        // incident, confirmed in runtime logs). Text extraction never renders a page,
        // so a minimal affine-matrix polyfill is sufficient; it is a no-op anywhere a
        // real DOMMatrix exists.
        installDomMatrixPolyfill()
        const { PDFParse } = await import('pdf-parse')
        const parser = new PDFParse({ data: buffer })
        try {
          const result = await withTimeout(parser.getText())
          // Strip pdf-parse's "-- N of M --" page-separator footers - noise, not resume content
          text = result.text.replace(/^--\s*\d+\s*of\s*\d+\s*--$/gm, '')
        } finally {
          await parser.destroy()
        }
      } catch (parseErr) {
        // pdf-parse threw outright (corrupted structure, unsupported encoding, etc.)  -
        // don't give up yet, fall through to the vision fallback below.
        const reason = parseErr instanceof Error ? parseErr.message : String(parseErr)
        console.error('[resume/extract-text] pdf-parse threw, will try vision fallback:', reason)
        // Loud telemetry: extraction failures were invisible for days because this path
        // only console.error'd. Every failure now leaves a queryable event.
        trackAsync(user.id, 'resume_extract_failed', { stage: 'pdf_parse', reason: reason.slice(0, 140) })
        text = ''
      }

      // Trigger vision fallback if:
      //   a) text layer is thin / empty (scanned or outlined-font PDF), OR
      //   b) text looks garbled (multi-column designer layout where pdf-parse reads in
      //      render order producing a jumble of tiny fragments).
      // Vision is infrastructure, not a premium feature — no rate limit gate here.
      const cleanedText = text.replace(/\n{3,}/g, '\n\n').trim()
      if (cleanedText.length < 300 || isGarbledPdfText(cleanedText)) {
        try {
          // The fallback is a real provider call over private resume data. It therefore
          // shares the central AI kill switch, global cost ceiling, and per-user quota.
          const privateVisionEnabled =
            isGeminiEnabled()
            && process.env.GEMINI_PRIVATE_DATA_ENABLED === 'true'
            && !!process.env.GEMINI_API_KEY
          const isPro = privateVisionEnabled ? await isProUser(user.id) : false
          const quota = privateVisionEnabled
            ? await checkRateLimit(user.id, 'resume_pdf_vision', isPro)
            : { allowed: false as const }
          if (!quota.allowed) {
            // Which gate blocked the rescue — booleans only, never env values.
            const gates = privateVisionEnabled
              ? 'quota_denied'
              : [
                  !isGeminiEnabled() && 'gemini_kill_switch',
                  process.env.GEMINI_PRIVATE_DATA_ENABLED !== 'true' && 'private_data_flag_off',
                  !process.env.GEMINI_API_KEY && 'no_api_key',
                ].filter(Boolean).join(',')
            trackAsync(user.id, 'resume_extract_failed', { stage: 'vision_gate', reason: gates })
          }
          const visionText = quota.allowed
            ? await withTimeout(extractPdfViaVision(buffer))
            : ''
          if (visionText.length >= 50) {
            text = visionText
            usedVisionFallback = true
            trackAsync(user.id, 'resume_pdf_vision', {
              triggered_by: cleanedText.length < 300 ? 'thin_text' : 'garbled_text',
              text_before: cleanedText.length,
            })
          } else if (quota.allowed) {
            trackAsync(user.id, 'resume_extract_failed', { stage: 'vision_empty', reason: `vision returned ${visionText.length} chars` })
          }
        } catch (visionErr) {
          const reason = visionErr instanceof Error ? visionErr.message : String(visionErr)
          console.error('[resume/extract-text] vision fallback failed:', reason)
          trackAsync(user.id, 'resume_extract_failed', { stage: 'vision_error', reason: reason.slice(0, 140) })
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
      trackAsync(user.id, 'resume_extract_failed', { stage: 'too_short', reason: `final text ${text.length} chars`, used_vision: usedVisionFallback })
      return NextResponse.json(
        {
          error: 'extraction_too_short',
          message: isPdf
            ? 'This PDF appears to have no readable text or image content (it may be empty or corrupted) - try pasting the text manually instead.'
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
