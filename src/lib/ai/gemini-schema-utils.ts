// Gemini's responseJsonSchema accepts a real but restricted subset of JSON Schema.
// zod's z.toJSONSchema() output is otherwise-valid JSON Schema that Gemini's API
// rejects outright with a generic 400 INVALID_ARGUMENT (no detail on which keyword)
// for several keywords it doesn't support. Found by direct API testing against a
// real billed project, not from documentation -- the rejection gives zero indication
// of which field is the problem, so this was isolated by binary-searching which
// keyword removal made an otherwise-identical request start succeeding.
//
// Confirmed-incompatible, in this SDK version, against this model:
//   - top-level "$schema"
//   - "additionalProperties" (anywhere)
//   - "minItems" / "maxItems" / "minLength" / "maxLength" (anywhere)
//   - `anyOf: [X, { type: "null" }]` for optional/nullable fields -- needs the older
//     `nullable: true` flag merged onto X instead.
// Confirmed-fine: "enum", "required", nested objects/arrays, "type", "properties".
export function toGeminiJsonSchema(jsonSchema: unknown): unknown {
  const clone = structuredClone(jsonSchema)
  stripUnsupportedKeywords(clone)
  return clone
}

function stripUnsupportedKeywords(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) stripUnsupportedKeywords(item)
    return
  }
  if (node === null || typeof node !== 'object') return

  const obj = node as Record<string, unknown>
  delete obj.$schema
  delete obj.additionalProperties
  delete obj.minItems
  delete obj.maxItems
  delete obj.minLength
  delete obj.maxLength

  const anyOf = obj.anyOf
  if (Array.isArray(anyOf) && anyOf.length === 2) {
    const nullBranch = anyOf.find((b) => typeof b === 'object' && b !== null && (b as Record<string, unknown>).type === 'null')
    const realBranch = anyOf.find((b) => b !== nullBranch)
    if (nullBranch && realBranch && typeof realBranch === 'object') {
      // Sanitize the branch BEFORE merging it in -- merging first and recursing
      // after doesn't re-visit the now-merged scalar keywords (e.g. maxLength),
      // since the top-level delete calls above already ran once for this node.
      stripUnsupportedKeywords(realBranch)
      delete obj.anyOf
      Object.assign(obj, realBranch, { nullable: true })
    }
  }

  for (const key of Object.keys(obj)) {
    stripUnsupportedKeywords(obj[key])
  }
}
