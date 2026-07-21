export function stripMarkdownExtension(value) {
  return String(value ?? '').trim().replace(/(?:\.md)+$/i, '').trim()
}

export function markdownFilename(value) {
  const base = stripMarkdownExtension(value) || 'documento'
  return `${base}.md`
}
