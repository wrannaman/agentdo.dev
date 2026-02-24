import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)

/**
 * Validate data against a JSON Schema.
 * Returns null if valid, or an array of error messages if invalid.
 */
export function validateSchema(
  schema: Record<string, unknown>,
  data: unknown
): string[] | null {
  try {
    const valid = ajv.validate(schema, data)
    if (valid) return null
    return (ajv.errors || []).map(
      (e) => `${e.instancePath || '/'} ${e.message}`
    )
  } catch (err) {
    return [`Schema validation error: ${(err as Error).message}`]
  }
}

/**
 * Validate that an output_schema is itself a valid JSON Schema.
 * Loose check — just make sure it's an object with a type or properties.
 */
export function isValidJsonSchema(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') return false
  const s = schema as Record<string, unknown>
  return !!(s.type || s.properties || s.items || s.oneOf || s.anyOf || s.allOf)
}
