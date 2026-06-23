#!/usr/bin/env node --experimental-strip-types
// Deterministic tests for Recorded Mode's audio validation — no Supabase, no Gemini.
// Mirrors the adversarial bar scripts/test-uploads.mjs already sets for resume
// uploads: extension spoofing, magic-byte mismatch, oversized/undersized files.
import { validateAudioUpload, buildAudioStoragePath, MAX_AUDIO_BYTES, MIN_AUDIO_BYTES } from '../src/lib/interviews/audio-validation.ts'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

function padTo(buffer, size) {
  if (buffer.length >= size) return buffer
  return Buffer.concat([buffer, Buffer.alloc(size - buffer.length, 0x41)])
}

const REAL_FILES = {
  webm: padTo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]), 1024),
  wav: padTo(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]), 1024),
  ogg: padTo(Buffer.from('OggS' + 'x'.repeat(20)), 1024),
  mp3_id3: padTo(Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00]), 1024),
  mp3_framesync: padTo(Buffer.from([0xff, 0xfb, 0x90, 0x00]), 1024),
}

// ── Genuine, well-formed files of every allowed type pass ───────────────────
record('A real .webm file with correct content+MIME passes', validateAudioUpload(REAL_FILES.webm, 'answer.webm', 'audio/webm').valid)
record('A real .wav file with correct content+MIME passes', validateAudioUpload(REAL_FILES.wav, 'answer.wav', 'audio/wav').valid)
record('A real .ogg file with correct content+MIME passes', validateAudioUpload(REAL_FILES.ogg, 'answer.ogg', 'audio/ogg').valid)
record('A real .mp3 file (ID3 header) with correct content+MIME passes', validateAudioUpload(REAL_FILES.mp3_id3, 'answer.mp3', 'audio/mpeg').valid)
record('A real .mp3 file (frame sync, no ID3) with correct content+MIME passes', validateAudioUpload(REAL_FILES.mp3_framesync, 'answer.mp3', 'audio/mpeg').valid)
record('A validated file reports its detected extension', validateAudioUpload(REAL_FILES.webm, 'answer.webm', 'audio/webm').extension === 'webm')

// ── Extension spoofing: real content, wrong extension/MIME claimed ──────────
{
  const r = validateAudioUpload(REAL_FILES.webm, 'answer.wav', 'audio/wav')
  record('A webm file renamed to .wav is rejected (content does not match claimed extension)', !r.valid, r.error)
}
{
  const r = validateAudioUpload(REAL_FILES.mp3_id3, 'answer.ogg', 'audio/ogg')
  record('An mp3 file renamed to .ogg is rejected', !r.valid, r.error)
}
{
  // Extension says wav, declared MIME says mp3 — internally inconsistent before content is even checked
  const r = validateAudioUpload(REAL_FILES.wav, 'answer.wav', 'audio/mpeg')
  record('Mismatched extension vs. declared MIME type is rejected even before checking content', !r.valid, r.error)
}

// ── Non-audio content disguised with an audio extension ─────────────────────
{
  const exe = padTo(Buffer.from([0x4d, 0x5a, 0x90, 0x00]), 1024) // "MZ" — Windows PE executable header
  const r = validateAudioUpload(exe, 'totally-an-audio-file.mp3', 'audio/mpeg')
  record('An executable disguised with an .mp3 extension is rejected', !r.valid, r.error)
}
{
  const html = padTo(Buffer.from('<html><script>alert(1)</script></html>'), 1024)
  const r = validateAudioUpload(html, 'recording.wav', 'audio/wav')
  record('HTML content disguised as .wav is rejected', !r.valid, r.error)
}

// ── Size bounds ───────────────────────────────────────────────────────────
{
  const tiny = Buffer.from([0x1a, 0x45, 0xdf, 0xa3])
  const r = validateAudioUpload(tiny, 'answer.webm', 'audio/webm')
  record(`A file under ${MIN_AUDIO_BYTES} bytes is rejected as too small`, !r.valid, r.error)
}
{
  const huge = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(MAX_AUDIO_BYTES + 1024, 0x41)])
  const r = validateAudioUpload(huge, 'answer.webm', 'audio/webm')
  record(`A file over the ${MAX_AUDIO_BYTES / (1024 * 1024)}MB cap is rejected`, !r.valid, r.error)
}
{
  const empty = Buffer.alloc(0)
  const r = validateAudioUpload(empty, 'answer.webm', 'audio/webm')
  record('A zero-byte file is rejected', !r.valid, r.error)
}

// ── Unsupported / malformed extensions ───────────────────────────────────────
record('An unsupported extension (.exe) is rejected regardless of content', !validateAudioUpload(REAL_FILES.webm, 'answer.exe', 'audio/webm').valid)
record('A filename with no extension at all is rejected', !validateAudioUpload(REAL_FILES.webm, 'answer', 'audio/webm').valid)
record('A path-traversal filename is rejected (no valid trailing extension match)', !validateAudioUpload(REAL_FILES.webm, '../../../etc/passwd', 'audio/webm').valid)

// ── Storage path construction never echoes unsanitized input ────────────────
{
  const path = buildAudioStoragePath('user-123', 'session-abc', 'question-xyz', 1, 'webm')
  record('Storage path is built only from already-validated, structured components', path === 'user-123/session-abc/question-xyz-attempt1.webm', path)
}

console.log(`\n  Interview audio validation test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
