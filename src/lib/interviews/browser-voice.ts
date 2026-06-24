'use client'

// Browser-native voice I/O using the Web Speech API (SpeechSynthesis for the question
// being read aloud, SpeechRecognition for dictating an answer). Zero API key, zero
// secrets, zero Gemini involvement — deliberately a SEPARATE path from
// src/lib/interviews/gemini/live.ts's Gemini Live integration, which remains gated
// and unimplemented. This is real, working voice I/O today, just lower-quality and
// browser-dependent (Chrome/Edge support SpeechRecognition; Firefox/Safari do not as
// of this build) rather than a live AI conversation.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

// Feature detection (does this browser support SpeechRecognition/speechSynthesis)
// must agree between server and client render or React flags a hydration mismatch —
// there is no window on the server, so a server-rendered "false" must match the
// client's first render exactly. useSyncExternalStore with a fixed getServerSnapshot
// is the React-documented pattern for this (same one used by
// src/components/landing/animated-section.tsx's usePrefersReducedMotion). These
// features don't change after load, so subscribe is a no-op.
function noopSubscribe() {
  return () => {}
}

interface MinimalSpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speakText(text: string) {
  if (!isSpeechSynthesisSupported()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel()
}

export interface BrowserVoiceDictation {
  dictationSupported: boolean
  listening: boolean
  toggleListening: () => void
}

/** Appends each finalized recognition result to the caller's answer text via onTranscript. */
export function useBrowserDictation(onTranscript: (finalSegment: string) => void): BrowserVoiceDictation {
  const dictationSupported = useSyncExternalStore(noopSubscribe, () => getSpeechRecognitionConstructor() !== null, () => false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null)

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const RecognitionCtor = getSpeechRecognitionConstructor()
    if (!RecognitionCtor) return
    const recognition = new RecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal && result[0]?.transcript) {
          onTranscript(result[0].transcript.trim())
        }
      }
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  useEffect(() => {
    return () => recognitionRef.current?.stop()
  }, [])

  return { dictationSupported, listening, toggleListening }
}

export function useSpeechSynthesisSupport(): boolean {
  return useSyncExternalStore(noopSubscribe, isSpeechSynthesisSupported, () => false)
}
