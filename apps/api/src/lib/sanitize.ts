// ─── Text Sanitization ────────────────────────────────────────────────────

const HTML_TAG_RE = /<[^>]*>/g
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

/**
 * Strip HTML tags, control characters, limit length, trim whitespace.
 */
export function sanitizeText(input: string, maxLength: number = 500): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(HTML_TAG_RE, '')
    .replace(CONTROL_CHAR_RE, '')
    .trim()
    .slice(0, maxLength)
}

/**
 * Business name: alphanumeric, spaces, common punctuation only.
 * Allows: letters, numbers, spaces, hyphens, apostrophes, periods, commas, ampersands.
 */
export function sanitizeBusinessName(name: string): string {
  if (typeof name !== 'string') return ''
  return name
    .replace(HTML_TAG_RE, '')
    .replace(CONTROL_CHAR_RE, '')
    .replace(/[^a-zA-Z0-9\s\-'.,&áàâãäåéèêëíìîïóòôõöúùûüñçÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÇ]/g, '')
    .trim()
    .slice(0, 200)
}

/**
 * Prize name: same rules as business name.
 */
export function sanitizePrizeName(name: string): string {
  if (typeof name !== 'string') return ''
  return name
    .replace(HTML_TAG_RE, '')
    .replace(CONTROL_CHAR_RE, '')
    .replace(/[^a-zA-Z0-9\s\-'.,&%$!áàâãäåéèêëíìîïóòôõöúùûüñçÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÇ]/g, '')
    .trim()
    .slice(0, 100)
}

/**
 * Sanitize an object's string fields in place.
 * Pass field names and their sanitizer function.
 */
export function sanitizeBody<T extends Record<string, unknown>>(
  body: T,
  fields: Record<string, (input: string) => string>,
): T {
  for (const [key, sanitizer] of Object.entries(fields)) {
    if (typeof body[key] === 'string') {
      (body as any)[key] = sanitizer(body[key] as string)
    }
  }
  return body
}
