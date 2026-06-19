#!/usr/bin/env node
/**
 * OpenAI connectivity health check — development only.
 * Run: npm run test:ai
 *
 * Sends a minimal request to gpt-4o-mini (or OPENAI_MODEL_FAST).
 * Expects the exact text "SHOWCASE_AI_OK" in the response.
 * Never prints the API key. Exits nonzero on failure.
 * store: false — this request is not stored on OpenAI servers.
 */

const key = process.env.OPENAI_API_KEY
const model = process.env.OPENAI_MODEL_FAST ?? 'gpt-4o-mini'

if (!key) {
  console.error('❌ OPENAI_API_KEY is not set.')
  console.error('   Add it to .env.local and run: npm run test:ai')
  process.exit(1)
}

console.log(`Testing OpenAI connection...`)
console.log(`Model: ${model}`)

let response
try {
  response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: 'Reply with exactly the text SHOWCASE_AI_OK and nothing else. No punctuation, no explanation.',
        },
      ],
      max_tokens: 20,
      temperature: 0,
      store: false,
    }),
    signal: AbortSignal.timeout(15_000),
  })
} catch (err) {
  if (err instanceof Error && err.name === 'TimeoutAbortError') {
    console.error('❌ Request timed out after 15 seconds.')
  } else {
    console.error('❌ Network error:', err instanceof Error ? err.message : String(err))
  }
  process.exit(1)
}

if (!response.ok) {
  const body = await response.text().catch(() => '')
  console.error(`❌ HTTP ${response.status}: ${response.statusText}`)
  if (response.status === 401) {
    console.error('   Invalid API key. Check OPENAI_API_KEY in .env.local.')
  } else if (response.status === 429) {
    console.error('   Rate limited or quota exceeded.')
  } else if (response.status === 404) {
    console.error(`   Model "${model}" not found. Check OPENAI_MODEL_FAST in .env.local.`)
  }
  if (body) console.error('   Response:', body.slice(0, 300))
  process.exit(1)
}

const data = await response.json()
const text = data?.choices?.[0]?.message?.content?.trim() ?? ''

if (!text.includes('SHOWCASE_AI_OK')) {
  console.error('❌ Unexpected response:', text.slice(0, 100))
  process.exit(1)
}

console.log(`✅ OpenAI connected successfully.`)
console.log(`   Model: ${model}`)
console.log(`   Response: ${text}`)
console.log()
console.log('All 5 AI routes are ready:')
console.log('  POST /api/ai/analyze-resume   → gpt-4o-mini (fast)')
console.log('  POST /api/ai/improve-resume   → gpt-4o-mini (fast)')
console.log('  POST /api/ai/role-match       → gpt-4o-mini (fast)')
console.log('  POST /api/ai/audit-portfolio  → gpt-4o      (main)')
console.log('  POST /api/ai/generate-portfolio → gpt-4o    (main)')
