// Supabase Edge Function: WebSocket proxy for Gemini Live API.
//
// WHY this proxy exists:
//   Gemini ephemeral tokens (auth_tokens/xxx) only work with the
//   BidiGenerateContentConstrained endpoint, whose model registry uses the v1main
//   (stable) catalog. The Live model gemini-2.0-flash-live-001 is NOT in that
//   catalog — it requires BidiGenerateContent with a real API key (v1alpha).
//   We cannot expose the real API key to the browser, so this proxy:
//     browser → this Edge Function (validated Supabase JWT auth)
//              → Gemini BidiGenerateContent (real API key, never in browser)
//   Messages are proxied transparently in both directions. The browser sends
//   the same JSON wire format as it would send directly to Gemini.
//
// Security:
//   - JWT validated via Supabase admin client before WebSocket upgrade
//   - Session ownership verified against the database
//   - GEMINI_API_KEY is a Supabase secret, never sent to the browser
//   - The proxy is transparent: it does NOT log or persist message content
//
// IMPORTANT: Deno's WebSocket.close() only accepts code 1000 or 3000-4999
// (same restriction as browser client WebSockets). Using 1011, 1008, etc.
// throws InvalidAccessError, which crashes the handler → browser sees 1006.
// Always use safeClose() which maps to 4xxx codes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// v1alpha: required for Live API models (gemini-2.0-flash-live-001, etc.)
const GEMINI_WS_URL =
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage` +
  `.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`

// Close a WebSocket using only codes that won't throw: 1000 or 4000-4999.
function safeClose(socket: WebSocket, code: number, reason: string) {
  try {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      const safeCode = code === 1000 ? 1000 : (code >= 4000 && code <= 4999 ? code : 4000)
      socket.close(safeCode, reason.slice(0, 123)) // close reason max 123 bytes
    }
  } catch (e) {
    console.error('[live-ws] safeClose error:', e)
  }
}

Deno.serve(async (req) => {
  // CORS preflight for SSE/fetch requests; actual WS upgrades don't hit this.
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
      },
    })
  }

  if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 })
  }

  const url = new URL(req.url)
  const jwt = url.searchParams.get('jwt')
  const sessionId = url.searchParams.get('session_id')

  if (!jwt || !sessionId) {
    return new Response('Missing jwt or session_id', { status: 400 })
  }

  if (!GEMINI_API_KEY) {
    console.error('[live-ws] GEMINI_API_KEY secret not set')
    return new Response('GEMINI_API_KEY secret not set', { status: 503 })
  }

  // Validate user JWT before upgrading — must happen before WebSocket upgrade
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !user) {
    console.error('[live-ws] Auth failed:', authError?.message)
    return new Response('Unauthorized', { status: 401 })
  }

  // Verify session ownership and that it's a voice session
  const { data: session } = await supabase
    .from('interview_sessions')
    .select('id, delivery_mode, status')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!session) {
    return new Response('Session not found', { status: 404 })
  }
  if (session.delivery_mode !== 'voice') {
    return new Response('Session is not in voice mode', { status: 409 })
  }

  console.log(`[live-ws] upgrading for session=${sessionId} user=${user.id}`)

  // Auth validated — now upgrade to WebSocket
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req)

  // Connect to Gemini (async handshake; not open yet)
  const geminiSocket = new WebSocket(GEMINI_WS_URL)
  // Get binary frames as ArrayBuffer (not Blob) for reliable forwarding in Deno
  geminiSocket.binaryType = 'arraybuffer'

  // Buffer messages from the browser until Gemini is ready
  const pendingToGemini: string[] = []

  geminiSocket.onopen = () => {
    console.log(`[live-ws] Gemini open, flushing ${pendingToGemini.length} pending`)
    for (const msg of pendingToGemini) {
      try { geminiSocket.send(msg) } catch (e) { console.error('[live-ws] flush error:', e) }
    }
    pendingToGemini.length = 0
  }

  // Proxy: browser → Gemini
  clientSocket.onmessage = (e) => {
    const data = e.data
    if (typeof data !== 'string') return // we only proxy text (JSON) frames
    if (geminiSocket.readyState === WebSocket.OPEN) {
      try { geminiSocket.send(data) } catch (e) { console.error('[live-ws] →gemini error:', e) }
    } else {
      pendingToGemini.push(data)
    }
  }

  // Proxy: Gemini → browser
  geminiSocket.onmessage = (e) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      try { clientSocket.send(e.data) } catch (e) { console.error('[live-ws] →client error:', e) }
    }
  }

  geminiSocket.onerror = (e) => {
    console.error('[live-ws] Gemini error:', e)
    safeClose(clientSocket, 4500, 'Gemini connection error')
  }

  geminiSocket.onclose = (e) => {
    console.log(`[live-ws] Gemini closed: code=${e.code} reason=${e.reason} clean=${e.wasClean}`)
    safeClose(clientSocket, 4000, e.reason || 'Gemini session ended')
  }

  clientSocket.onerror = (e) => {
    console.error('[live-ws] Client error:', e)
    safeClose(geminiSocket, 1000, '')
  }

  clientSocket.onclose = (e) => {
    console.log(`[live-ws] Client closed: code=${e.code}`)
    safeClose(geminiSocket, 1000, '')
  }

  return response
})
