import { openai, MODELS } from './openai'

// Last-resort fallback when standard text extraction (pdf-parse) fails or returns
// near-empty text — most commonly scanned/photographed resumes, PDFs exported with
// outlined fonts (no embedded text layer at all, e.g. some Canva/design-tool exports),
// or a PDF whose internal structure trips up the parser despite being visually normal.
// A vision-capable model can read the page as an image regardless of whether the PDF
// has an extractable text layer, so this rescues files that no text parser ever could.
export async function extractPdfViaVision(buffer: Buffer): Promise<string> {
  const base64 = buffer.toString('base64')

  const response = await openai.responses.create({
    model: MODELS.main,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Transcribe ALL text from this document verbatim, preserving the original structure (headings, bullet points, line breaks). Do not summarize, explain, or add commentary — output only the transcribed text. If the document contains no readable text at all, output exactly: NO_TEXT_FOUND',
          },
          { type: 'input_file', filename: 'resume.pdf', file_data: `data:application/pdf;base64,${base64}` },
        ],
      },
    ],
  })

  const text = response.output_text?.trim() ?? ''
  if (!text || text === 'NO_TEXT_FOUND') return ''
  return text
}
