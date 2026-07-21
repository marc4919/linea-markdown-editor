const ABSOLUTE_PROTOCOL = /^([a-z][a-z\d+.-]*):/i
const RELATIVE_DESTINATION = /^(?:#|\?|\/(?!\/)|\.\.?\/)/

export function normalizeMarkdownDestination(value, { image = false } = {}) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null

  if (!image && RELATIVE_DESTINATION.test(trimmed)) return trimmed

  if (!image && /^(?:mailto|tel):/i.test(trimmed)) return trimmed

  const protocol = trimmed.match(ABSOLUTE_PROTOCOL)?.[1]?.toLowerCase()
  if (protocol && protocol !== 'http' && protocol !== 'https') return null

  const candidate = trimmed.startsWith('//')
    ? `https:${trimmed}`
    : protocol ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(candidate)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null
  } catch {
    return null
  }
}
