#!/usr/bin/env node --experimental-strip-types
// Deterministic test for toGeminiJsonSchema(). The bug this guards against: zod's
// z.toJSONSchema() output is otherwise-valid JSON Schema that Gemini's
// responseJsonSchema rejects outright with a generic 400 (no detail on which
// keyword). Found only by direct testing against a real billed project — this test
// locks in the specific transform so it can't silently regress.
import { z } from 'zod'
import { toGeminiJsonSchema } from '../src/lib/ai/gemini-schema-utils.ts'

let PASS = 0, FAIL = 0
function record(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) PASS++; else FAIL++
}

const TestSchema = z.object({
  name: z.string().max(100),
  tags: z.array(z.string()).max(10),
  note: z.string().max(500).nullable(),
  count: z.array(z.string()).min(1).max(5),
  status: z.enum(['a', 'b', 'c']),
  nested: z.object({ inner: z.string() }),
})

const raw = z.toJSONSchema(TestSchema)
const cleaned = toGeminiJsonSchema(raw)
const cleanedStr = JSON.stringify(cleaned)

record('Strips top-level $schema', !('$schema' in cleaned))
record('Strips additionalProperties everywhere', !cleanedStr.includes('additionalProperties'))
record('Strips maxLength everywhere', !cleanedStr.includes('maxLength'))
record('Strips maxItems everywhere', !cleanedStr.includes('maxItems'))
record('Strips minItems everywhere', !cleanedStr.includes('minItems'))
record('Converts anyOf-with-null into nullable:true', cleaned.properties.note.nullable === true && cleaned.properties.note.type === 'string')
record('Does NOT touch anyOf-with-null branch content (still type string)', !('anyOf' in cleaned.properties.note))
record('Preserves enum (Gemini-supported keyword)', JSON.stringify(cleaned.properties.status.enum) === JSON.stringify(['a', 'b', 'c']))
record('Preserves required array (Gemini-supported keyword)', Array.isArray(cleaned.required) && cleaned.required.includes('name'))
record('Preserves nested object structure', cleaned.properties.nested.properties.inner.type === 'string')
record('Does not mutate the original input object (pure function)', '$schema' in raw)

console.log(`\n  Gemini schema sanitizer test: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
