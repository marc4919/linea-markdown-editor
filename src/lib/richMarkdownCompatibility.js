const FRONTMATTER_BLOCK = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/
const RAW_HTML = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<![A-Za-z][^>]*>|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?>/i
const REFERENCE_DEFINITION = /^[ \t]{0,3}\[(?!\^)[^\]\r\n]+\]:[ \t]*(?:\S|\r?\n[ \t]*\S)/m
const ORDERED_TASK_LIST = /^[ \t]{0,3}\d{1,9}[.)][ \t]+\[[ xX]\][ \t]+/m
const MARKDOWN_ENTITY = /(?<!\\)&(?:#\d+|#x[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]*);/
const INLINE_FOOTNOTE = /(?<!\\)\^\[[^\]\r\n]+\]/
const MULTI_BACKTICK_CODE = /(^|[^`])(`{2,})(?!`)[^\r\n]*?\2(?!`)/m

function hasComplexFootnoteDefinition(source) {
  const lines = source.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^[ \t]{0,3}\[\^[^\]\r\n]+\]:/.test(lines[index])) continue
    let continuation = index + 1
    while (continuation < lines.length && !lines[continuation].trim()) continuation += 1
    if (continuation < lines.length && /^(?: {2,}|\t)\S/.test(lines[continuation])) return true
  }
  return false
}

export function getInitialFrontmatterRange(markdown) {
  const source = String(markdown ?? '')
  const frontmatter = source.match(FRONTMATTER_BLOCK)
  if (!frontmatter || !/^\s*[A-Za-z0-9_.-]+\s*:/m.test(frontmatter[1])) return null
  return { start: 0, end: frontmatter[0].length }
}

export function getRichMarkdownLimitations(markdown) {
  const source = String(markdown ?? '')
  const limitations = []

  if (getInitialFrontmatterRange(source)) {
    limitations.push('metadatos de cabecera')
  }
  if (RAW_HTML.test(source)) limitations.push('HTML incrustado')
  if (REFERENCE_DEFINITION.test(source)) limitations.push('enlaces por referencia')
  if (ORDERED_TASK_LIST.test(source)) limitations.push('listas de tareas numeradas')
  if (MARKDOWN_ENTITY.test(source)) limitations.push('entidades Markdown')
  if (INLINE_FOOTNOTE.test(source)) limitations.push('notas al pie inline')
  if (hasComplexFootnoteDefinition(source)) limitations.push('notas al pie complejas')
  if (MULTI_BACKTICK_CODE.test(source)) limitations.push('código inline con backticks')

  return limitations
}

export function richMarkdownNotice(markdown) {
  const limitations = getRichMarkdownLimitations(markdown)
  if (!limitations.length) return ''
  const last = limitations.at(-1)
  const label = limitations.length === 1
    ? last
    : `${limitations.slice(0, -1).join(', ')} y ${last}`
  return `Este documento contiene ${label}. Para no perder ese Markdown, edítalo en el modo Markdown.`
}
