import 'server-only'
import { GoogleGenAI } from '@google/genai'

// Vision-based PDF text extraction via Gemini.
// Used as a fallback when the standard pdf-parse text layer is empty (scanned/outlined-font PDFs)
// or garbled (multi-column designer layouts where the text stream order is wrong).
// Requires GEMINI_API_KEY and GEMINI_PRIVATE_DATA_ENABLED=true - if either is absent, returns ''.
export async function extractPdfViaVision(buffer: Buffer): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
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
