const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? Math.trunc(value) : minimum))

function normalizeSelection(text, selectionStart = 0, selectionEnd = selectionStart) {
  const first = clamp(selectionStart, 0, text.length)
  const second = clamp(selectionEnd, 0, text.length)
  return first <= second ? { start: first, end: second } : { start: second, end: first }
}

function result(text, selectionStart, selectionEnd = selectionStart) {
  return { text, selectionStart, selectionEnd }
}

function blockInsertion(text, selectionStart, selectionEnd, content, selectedText = '') {
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const beforeBreak = start > 0 && text[start - 1] !== '\n' ? '\n\n' : ''
  const afterBreak = end < text.length && text[end] !== '\n' ? '\n\n' : ''
  const insertion = `${beforeBreak}${content}${afterBreak}`
  const nextText = text.slice(0, start) + insertion + text.slice(end)
  const selectedOffset = selectedText ? insertion.indexOf(selectedText) : insertion.length
  const nextStart = start + Math.max(0, selectedOffset)
  return result(nextText, nextStart, nextStart + selectedText.length)
}

export function toggleStrikethrough(text, selectionStart = 0, selectionEnd = selectionStart) {
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const selected = text.slice(start, end)
  const enclosingStart = start >= 2 && text.slice(start - 2, start) === '~~' ? start - 2 : -1
  const enclosingEnd = end + 2 <= text.length && text.slice(end, end + 2) === '~~' ? end + 2 : -1

  if (enclosingStart >= 0 && enclosingEnd >= 0) {
    const nextText = text.slice(0, enclosingStart) + selected + text.slice(enclosingEnd)
    return result(nextText, enclosingStart, enclosingStart + selected.length)
  }

  const content = selected || 'texto tachado'
  const insertion = `~~${content}~~`
  const nextText = text.slice(0, start) + insertion + text.slice(end)
  return result(nextText, start + 2, start + 2 + content.length)
}

export function toggleUnderline(text, selectionStart = 0, selectionEnd = selectionStart) {
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const selected = text.slice(start, end)
  const enclosingStart = start >= 2 && text.slice(start - 2, start) === '++' ? start - 2 : -1
  const enclosingEnd = end + 2 <= text.length && text.slice(end, end + 2) === '++' ? end + 2 : -1

  if (enclosingStart >= 0 && enclosingEnd >= 0) {
    const nextText = text.slice(0, enclosingStart) + selected + text.slice(enclosingEnd)
    return result(nextText, enclosingStart, enclosingStart + selected.length)
  }

  const content = selected || 'texto subrayado'
  const insertion = `++${content}++`
  const nextText = text.slice(0, start) + insertion + text.slice(end)
  return result(nextText, start + 2, start + 2 + content.length)
}

export function insertTable(text, selectionStart = 0, selectionEnd = selectionStart) {
  const template = '| Columna 1 | Columna 2 |\n| --- | --- |\n| Dato | Dato |'
  return blockInsertion(text, selectionStart, selectionEnd, template, 'Columna 1')
}

export function insertTask(text, selectionStart = 0, selectionEnd = selectionStart) {
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const nextLineBreak = text.indexOf('\n', end)
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak
  const selectedBlock = text.slice(lineStart, lineEnd)

  if (!selectedBlock.trim()) {
    const insertion = '- [ ] Una tarea'
    const nextText = text.slice(0, lineStart) + insertion + text.slice(lineEnd)
    const placeholderStart = lineStart + 6
    return result(nextText, placeholderStart, placeholderStart + 'Una tarea'.length)
  }

  const nextBlock = selectedBlock
    .split('\n')
    .map((line) => line.trim() ? `- [ ] ${line.replace(/^\s*(?:[-+*]|\d+\.)\s+/, '')}` : line)
    .join('\n')
  const nextText = text.slice(0, lineStart) + nextBlock + text.slice(lineEnd)
  return result(nextText, lineStart, lineStart + nextBlock.length)
}

export function insertCodeBlock(text, selectionStart = 0, selectionEnd = selectionStart, language = '') {
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const content = text.slice(start, end) || 'escribe tu código aquí'
  const template = `\`\`\`${language}\n${content}\n\`\`\``
  return blockInsertion(text, start, end, template, content)
}

export function insertHorizontalRule(text, selectionStart = 0, selectionEnd = selectionStart) {
  return blockInsertion(text, selectionStart, selectionEnd, '---')
}

export function createFootnoteMarkdown(text, noteContent) {
  const content = String(noteContent ?? '').trim()
  if (!content) return null
  const identifiers = [...text.matchAll(/\[\^(\d+)\]/g)].map((match) => Number(match[1]))
  const identifier = Math.max(0, ...identifiers) + 1
  const reference = `[^${identifier}]`
  const definition = `[^${identifier}]: ${content}`
  return {
    identifier,
    reference,
    definition,
    markdown: `${reference}\n\n${definition}`,
  }
}

export function insertFootnoteWithContent(text, selectionStart = 0, selectionEnd = selectionStart, noteContent = '') {
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const footnote = createFootnoteMarkdown(text, noteContent)
  if (!footnote) return result(text, start, end)

  const suffix = `${text.endsWith('\n') || !text ? '' : '\n'}\n${footnote.definition}`
  const insertionPoint = start === end ? start : end
  const nextText = text.slice(0, insertionPoint) + footnote.reference + text.slice(insertionPoint) + suffix
  const cursor = insertionPoint + footnote.reference.length
  return result(nextText, cursor)
}

export function insertFootnote(text, selectionStart = 0, selectionEnd = selectionStart) {
  const edit = insertFootnoteWithContent(text, selectionStart, selectionEnd, 'Nota al pie')
  const nextText = edit.text
  const noteStart = nextText.length - 'Nota al pie'.length
  return result(nextText, noteStart, nextText.length)
}

export function insertMermaid(text, selectionStart = 0, selectionEnd = selectionStart) {
  const template = '```mermaid\nflowchart LR\n  Idea --> Borrador\n  Borrador --> Publicación\n```'
  return blockInsertion(text, selectionStart, selectionEnd, template, 'Idea')
}

function escapeLabel(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll(']', '\\]')
}

function escapeDestination(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
}

export function insertImage(text, selectionStart = 0, selectionEnd = selectionStart, options = {}) {
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const selected = text.slice(start, end)
  const alt = escapeLabel(options.alt || selected || 'Descripción de la imagen')
  const url = escapeDestination(options.url || 'https://')
  const insertion = `![${alt}](${url})`
  const nextText = text.slice(0, start) + insertion + text.slice(end)
  const urlStart = start + alt.length + 4
  return result(nextText, urlStart, urlStart + url.length)
}
