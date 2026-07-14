import 'server-only'
import { randomUUID } from 'node:crypto'
import { GoogleGenAI } from '@google/genai'
import { isAIEnabled, isGeminiEnabled } from '../feature-flags.ts'
import { recordAiCostEvent } from '../growth/ai-cost.ts'

// gemini-2.5-flash list pricing (USD per million tokens) at the time this was written.
// Rates travel with each ledger row via pricingVersion, so a price change never
// silently corrupts historical spend data - update the version string when updating rates.
const GEMINI_FLASH_RATES = {
  inputPerMillion: 0.3,
  cachedInputPerMillion: 0.075,
  outputPerMillion: 2.5,
  pricingVersion: 'gemini-2.5-flash@2026-07',
}

// Vision-based PDF text extraction via Gemini.
// Used as a fallback when the standard pdf-parse text layer is empty (scanned/outlined-font PDFs)
// or garbled (multi-column designer layouts where the text stream order is wrong).
// Requires GEMINI_API_KEY and GEMINI_PRIVATE_DATA_ENABLED=true - if either is absent, returns ''.
export async function extractPdfViaVision(buffer: Buffer, userId?: string): Promise<string> {
  // Resume files contain private personal data. A key by itself is never consent to
  // transmit that data to another provider; production must opt in explicitly after the
  // privacy/provider review has been completed.
  if (!isAIEnabled() || !isGeminiEnabled()
    || !process.env.GEMINI_API_KEY
    || process.env.GEMINI_PRIVATE_DATA_ENABLED !== 'true') {
    return ''
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const base64 = buffer.toString('base64')

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64,
            },
          },
          {
            text: [
              'You are a precise OCR system. Transcribe ALL text from this resume document verbatim.',
              'Rules:',
              '- Preserve section headings, bullet points, and logical reading order.',
              '- For multi-column layouts, linearize in reading order (top-to-bottom within each section).',
              '- Do NOT summarize, add commentary, or change any wording.',
              '- Output ONLY the raw transcribed text.',
              '- If the document contains no readable text, output exactly: NO_TEXT_FOUND',
            ].join('\n'),
          },
        ],
      },
    ],
  })

  // Every other provider call in the app lands in the ai_cost_events ledger; this one
  // previously didn't, leaving Google spend invisible to the budget dashboard. Recording
  // is best-effort - a ledger hiccup must never fail an extraction the user is waiting on.
  try {
    const usage = response.usageMetadata
    await recordAiCostEvent({
      idempotencyKey: `resume_pdf_vision:${randomUUID()}`,
      feature: 'resume_pdf_vision',
      provider: 'google',
      model: 'gemini-2.5-flash',
      inputTokens: usage?.promptTokenCount ?? 0,
      cachedInputTokens: usage?.cachedContentTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
      rates: GEMINI_FLASH_RATES,
      userId: userId ?? null,
      estimated: !usage,
    })
  } catch (costErr) {
    console.error('[pdf-vision] cost recording failed:',
      costErr instanceof Error ? costErr.message : costErr)
  }

  const text = response.text?.trim() ?? ''
  if (!text || text === 'NO_TEXT_FOUND') return ''
  return text
}

// Heuristic: detect whether pdf-parse text output is garbled (common with multi-column
// designer PDFs where the internal text stream is in render order, not reading order).
export function isGarbledPdfText(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 50) return false
  const words = trimmed.split(/\s+/)
  if (words.length < 10) return false
  const tinyWords = words.filter((w) => w.replace(/[^a-zA-Z]/g, '').length <= 2)
  const tinyRatio = tinyWords.length / words.length
  return tinyRatio > 0.45
}
