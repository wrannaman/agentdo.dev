/** Max size limits */
const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 5000
const MAX_TAGS = 10
const MAX_TAG_LENGTH = 50
const MAX_JSON_DEPTH = 5
const MAX_JSON_SIZE = 50_000 // 50KB for input/output_schema/result

/**
 * Sanitize and validate task creation input.
 * Returns { clean, error } — error is a string if invalid.
 */
export function sanitizeTaskInput(body: Record<string, unknown>): {
  clean?: Record<string, unknown>
  error?: string
} {
  const { title, description, tags, input, output_schema, callback_url } = body

  // Title
  if (typeof title !== 'string' || title.trim().length === 0) {
    return { error: 'title is required' }
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `title must be under ${MAX_TITLE_LENGTH} characters` }
  }

  // Description
  if (description && typeof description === 'string' && description.length > MAX_DESCRIPTION_LENGTH) {
    return { error: `description must be under ${MAX_DESCRIPTION_LENGTH} characters` }
  }

  // Tags
  if (tags) {
    if (!Array.isArray(tags)) return { error: 'tags must be an array' }
    if (tags.length > MAX_TAGS) return { error: `max ${MAX_TAGS} tags` }
    for (const t of tags) {
      if (typeof t !== 'string' || t.length > MAX_TAG_LENGTH) {
        return { error: `each tag must be a string under ${MAX_TAG_LENGTH} chars` }
      }
    }
  }

  // JSON size checks
  if (input && JSON.stringify(input).length > MAX_JSON_SIZE) {
    return { error: `input must be under ${MAX_JSON_SIZE / 1000}KB` }
  }
  if (output_schema && JSON.stringify(output_schema).length > MAX_JSON_SIZE) {
    return { error: `output_schema must be under ${MAX_JSON_SIZE / 1000}KB` }
  }

  // callback_url — must be https if provided
  if (callback_url) {
    if (typeof callback_url !== 'string') return { error: 'callback_url must be a string' }
    try {
      const url = new URL(callback_url)
      if (url.protocol !== 'https:') {
        return { error: 'callback_url must use HTTPS' }
      }
      // Block private/internal IPs
      const host = url.hostname
      if (
        host === 'localhost' ||
        host.startsWith('127.') ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        host.startsWith('169.254.') ||
        host === '0.0.0.0' ||
        host.endsWith('.internal')
      ) {
        return { error: 'callback_url cannot point to internal addresses' }
      }
    } catch {
      return { error: 'callback_url must be a valid URL' }
    }
  }

  return { clean: body }
}

/**
 * Sanitize delivery result payload.
 */
export function sanitizeResult(body: Record<string, unknown>): {
  error?: string
} {
  const { result, result_url } = body

  if (result && JSON.stringify(result).length > MAX_JSON_SIZE * 2) {
    return { error: `result must be under ${(MAX_JSON_SIZE * 2) / 1000}KB` }
  }

  if (result_url) {
    if (typeof result_url !== 'string') return { error: 'result_url must be a string' }
    try {
      const url = new URL(result_url)
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { error: 'result_url must be HTTP or HTTPS' }
      }
    } catch {
      return { error: 'result_url must be a valid URL' }
    }
  }

  return {}
}
