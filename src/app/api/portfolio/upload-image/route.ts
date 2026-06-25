import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])
const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF....WEBP
]

function detectMime(buf: Uint8Array): string | null {
  for (const { bytes, offset = 0 } of MAGIC_BYTES) {
    if (bytes.every((b, i) => buf[offset + i] === b)) {
      if (bytes[0] === 0x52) {
        // RIFF — confirm WEBP at offset 8
        if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp'
        continue
      }
      const sig = MAGIC_BYTES.find((m) => m.bytes[0] === bytes[0] && m.mime !== 'image/webp')
      return sig?.mime ?? null
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await request.formData()
    const file = form.get('file') as File | null
    const slot = (form.get('slot') as string) ?? 'headshot' // headshot | hero | project-{n}

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 413 })
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 })

    const buf = new Uint8Array(await file.arrayBuffer())
    const detectedMime = detectMime(buf)
    if (!detectedMime || !ALLOWED_TYPES.has(detectedMime)) {
      return NextResponse.json({ error: 'File contents do not match an allowed image type' }, { status: 415 })
    }

    const ext = detectedMime.split('/')[1].replace('jpeg', 'jpg')
    const path = `${user.id}/${slot}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('portfolio-images')
      .upload(path, buf, { contentType: detectedMime, upsert: true })

    if (uploadError) {
      console.error('[portfolio/upload-image]', uploadError.message)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: signed } = await supabase.storage
      .from('portfolio-images')
      .createSignedUrl(path, 60 * 60 * 24 * 365) // 1-year signed URL

    return NextResponse.json({ data: { path, url: signed?.signedUrl } }, { status: 201 })
  } catch (err) {
    console.error('[portfolio/upload-image]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
