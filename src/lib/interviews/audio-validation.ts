// Deterministic audio-upload validation for Recorded Mode, following the exact
// pattern already established by the resume upload route (src/app/api/resume/
// extract-text/route.ts): never trust the client's declared extension or MIME type  - 
// verify the actual file content via magic bytes. A declared type that doesn't match
// the real file content is rejected outright, not silently corrected.

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // 25MB  -  generous for a single compressed answer, well under any plausible interview answer length
export const MIN_AUDIO_BYTES = 256 // rejects empty/stub files

export type AllowedAudioExtension = 'webm' | 'wav' | 'mp3' | 'ogg'

const EXTENSION_TO_MIME: Record<AllowedAudioExtension, string[]> = {
  webm: ['audio/webm'],
  wav: ['audio/wav', 'audio/x-wav', 'audio/wave'],
  mp3: ['audio/mpeg', 'audio/mp3'],
  ogg: ['audio/ogg'],
}

/** Canonical MIME type to send to Gemini for transcription  -  always derived from
 *  the validated extension, never the client's raw declared Content-Type (which
 *  EXTENSION_TO_MIME above allows several variants of, e.g. audio/x-wav). */
export const CANONICAL_MIME_FOR_EXTENSION: Record<AllowedAudioExtension, string> = {
  webm: 'audio/webm', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg',
}

export interface AudioValidationResult {
  valid: boolean
  error: string | null
  extension: AllowedAudioExtension | null
}

function bytesMatch(buffer: Buffer, offset: number, expected: number[]): boolean {
  if (buffer.length < offset + expected.length) return false
  for (let i = 0; i < expected.length; i++) {
    if (buffer[offset + i] !== expected[i]) return false
  }
  return true
}

/** Detects the real audio format from file content alone, ignoring any
 *  client-declared extension or MIME type. Returns null if the content doesn't
 *  match any allowed format's signature. */
function detectAudioFormat(buffer: Buffer): AllowedAudioExtension | null {
  // WebM/Matroska EBML header
  if (bytesMatch(buffer, 0, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm'
  // WAV: "RIFF" .... "WAVE"
  if (bytesMatch(buffer, 0, [0x52, 0x49, 0x46, 0x46]) && bytesMatch(buffer, 8, [0x57, 0x41, 0x56, 0x45])) return 'wav'
  // OGG: "OggS"
  if (bytesMatch(buffer, 0, [0x4f, 0x67, 0x67, 0x53])) return 'ogg'
  // MP3: ID3 tag, or a raw frame sync (0xFF followed by an MPEG audio sync nibble)
  if (bytesMatch(buffer, 0, [0x49, 0x44, 0x33])) return 'mp3'
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'mp3'
  return null
}

function extensionFromFilename(filename: string): string | null {
  const match = /\.([a-zA-Z0-9]{1,10})$/.exec(filename)
  return match ? match[1].toLowerCase() : null
}

/**
 * Validates an uploaded audio buffer end to end: size bounds, declared extension is
 * one of the allowed types, declared MIME type is consistent with that extension,
 * AND the actual file content's magic bytes match the detected format. All four
 * checks must pass  -  any single mismatch (e.g. a .wav-named file containing webm
 * bytes) fails closed, matching the resume upload route's "rejects files where
 * declared type doesn't match actual content" discipline.
 */
export function validateAudioUpload(buffer: Buffer, filename: string, declaredMimeType: string): AudioValidationResult {
  if (buffer.length < MIN_AUDIO_BYTES) {
    return { valid: false, error: 'File is too small to be a real audio recording.', extension: null }
  }
  if (buffer.length > MAX_AUDIO_BYTES) {
    return { valid: false, error: `File exceeds the ${MAX_AUDIO_BYTES / (1024 * 1024)}MB limit.`, extension: null }
  }

  const declaredExtension = extensionFromFilename(filename)
  if (!declaredExtension || !(declaredExtension in EXTENSION_TO_MIME)) {
    return { valid: false, error: 'Unsupported file extension.', extension: null }
  }
  const ext = declaredExtension as AllowedAudioExtension

  if (!EXTENSION_TO_MIME[ext].includes(declaredMimeType)) {
    return { valid: false, error: 'Declared file type does not match the file extension.', extension: null }
  }

  const detected = detectAudioFormat(buffer)
  if (!detected) {
    return { valid: false, error: 'File content is not a recognized audio format.', extension: null }
  }
  if (detected !== ext) {
    return { valid: false, error: `File extension claims "${ext}" but the actual content is "${detected}".`, extension: null }
  }

  return { valid: true, error: null, extension: detected }
}

/** Produces a safe, predictable storage path  -  never derived from unsanitized user
 *  input beyond the already-validated extension, closing the same path-traversal
 *  class scripts/test-uploads.mjs already checks for on the resume upload route. */
export function buildAudioStoragePath(userId: string, sessionId: string, questionId: string, attemptNumber: number, extension: AllowedAudioExtension): string {
  return `${userId}/${sessionId}/${questionId}-attempt${attemptNumber}.${extension}`
}
