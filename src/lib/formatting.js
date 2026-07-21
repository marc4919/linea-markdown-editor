/**
 * Pure Markdown editing helpers for textarea-like controls.
 *
 * Every mutation returns the complete next text together with the selection
 * that should be restored after React has rendered it.
 */

const INLINE_MARKERS = {
  bold: '**',
  italic: '_',
  code: '`',
}

const INLINE_PLACEHOLDERS = {
  bold: 'texto importante',
  italic: 'texto',
  code: 'código',
}

const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? Math.trunc(value) : minimum))

function normalizeSelection(text, selectionStart = 0, selectionEnd = selectionStart) {
  const first = clamp(selectionStart, 0, text.length)
  const second = clamp(selectionEnd, 0, text.length)

  return first <= second
    ? { start: first, end: second }
    : { start: second, end: first }
}

function editResult(text, selectionStart, selectionEnd = selectionStart) {
  return { text, selectionStart, selectionEnd }
}

function isEscaped(text, index) {
  let backslashes = 0
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    backslashes += 1
  }
  return backslashes % 2 === 1
}

function markerIsStandalone(text, index, marker) {
  if (marker === '_' && (text[index - 1] === '_' || text[index + 1] === '_')) return false
  if (marker === '**' && (text[index - 1] === '*' || text[index + 2] === '*')) return false
  return true
}

function findNextMarker(text, marker, from, lineEnd) {
  let index = text.indexOf(marker, from)
  while (index !== -1 && index < lineEnd) {
    if (!isEscaped(text, index) && markerIsStandalone(text, index, marker)) return index
    index = text.indexOf(marker, index + marker.length)
  }
  return -1
}

function getDelimitedSpans(text, marker) {
  const spans = []
  let lineStart = 0

  while (lineStart <= text.length) {
    const newline = text.indexOf('\n', lineStart)
    const lineEnd = newline === -1 ? text.length : newline
    let cursor = lineStart

    while (cursor < lineEnd) {
      const open = findNextMarker(text, marker, cursor, lineEnd)
      if (open === -1) break
      const close = findNextMarker(text, marker, open + marker.length, lineEnd)
      if (close === -1) break

      spans.push({
        fullStart: open,
        contentStart: open + marker.length,
        contentEnd: close,
        fullEnd: close + marker.length,
        markerLength: marker.length,
      })
      cursor = close + marker.length
    }

    if (newline === -1) break
    lineStart = newline + 1
  }

  return spans
}

function spanContainsSelection(span, start, end) {
  if (start === end) return start >= span.contentStart && start <= span.contentEnd

  const contentIsSelected = start >= span.contentStart && end <= span.contentEnd
  const wholeSpanIsSelected = start === span.fullStart && end === span.fullEnd
  return contentIsSelected || wholeSpanIsSelected
}

function findDelimitedSpan(text, start, end, marker) {
  return getDelimitedSpans(text, marker)
    .filter((span) => spanContainsSelection(span, start, end))
    .sort((left, right) => (left.fullEnd - left.fullStart) - (right.fullEnd - right.fullStart))[0] ?? null
}

function mapAfterDelimiterRemoval(position, span) {
  const { fullStart, contentStart, contentEnd, fullEnd, markerLength } = span

  if (position <= fullStart) return position
  if (position < contentStart) return fullStart
  if (position <= contentEnd) return position - markerLength
  if (position < fullEnd) return contentEnd - markerLength
  return position - markerLength * 2
}

function toggleInline(text, selectionStart, selectionEnd, marker, placeholder) {
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const enclosing = findDelimitedSpan(text, start, end, marker)

  if (enclosing) {
    const nextText =
      text.slice(0, enclosing.fullStart) +
      text.slice(enclosing.contentStart, enclosing.contentEnd) +
      text.slice(enclosing.fullEnd)

    return editResult(
      nextText,
      mapAfterDelimiterRemoval(start, enclosing),
      mapAfterDelimiterRemoval(end, enclosing),
    )
  }

  const content = start === end ? placeholder : text.slice(start, end)
  const insertion = `${marker}${content}${marker}`
  const nextText = text.slice(0, start) + insertion + text.slice(end)
  const contentStart = start + marker.length

  return editResult(nextText, contentStart, contentStart + content.length)
}

function getSelectedLines(text, start, end) {
  const rangeStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const adjustedEnd = end > start && text[end - 1] === '\n' ? end - 1 : end
  const nextNewline = text.indexOf('\n', adjustedEnd)
  const rangeEnd = nextNewline === -1 ? text.length : nextNewline
  const lines = []
  let lineStart = rangeStart

  while (lineStart <= rangeEnd) {
    const newline = text.indexOf('\n', lineStart)
    const lineEnd = newline === -1 || newline > rangeEnd ? rangeEnd : newline
    lines.push({ start: lineStart, end: lineEnd, text: text.slice(lineStart, lineEnd) })
    if (newline === -1 || newline >= rangeEnd) break
    lineStart = newline + 1
  }

  return { rangeStart, rangeEnd, lines }
}

function mapPositionThroughEdits(position, edits, bias = 'right') {
  let delta = 0

  for (const edit of edits) {
    const removedLength = edit.end - edit.start
    const addedLength = edit.replacement.length

    if (position < edit.start) break

    if (removedLength === 0 && position === edit.start) {
      return edit.start + delta + (bias === 'right' ? addedLength : 0)
    }

    if (position <= edit.end) {
      return edit.start + delta + (bias === 'right' ? addedLength : 0)
    }

    delta += addedLength - removedLength
  }

  return position + delta
}

function applyEdits(text, selectionStart, selectionEnd, edits) {
  const ordered = [...edits].sort((left, right) => left.start - right.start)
  let cursor = 0
  let nextText = ''

  for (const edit of ordered) {
    nextText += text.slice(cursor, edit.start) + edit.replacement
    cursor = edit.end
  }
  nextText += text.slice(cursor)

  return editResult(
    nextText,
    mapPositionThroughEdits(selectionStart, ordered),
    mapPositionThroughEdits(selectionEnd, ordered),
  )
}

function getIndentLength(line) {
  return line.match(/^[ \t]*/)?.[0].length ?? 0
}

function getListPrefix(line) {
  const match = line.match(/^([ \t]*)(?:[-+*])(?:[ \t]+|$)/)
  if (!match) return null
  return { start: match[1].length, end: match[0].length }
}

function getQuotePrefix(line) {
  const match = line.match(/^([ \t]*)>[ \t]?/)
  if (!match) return null
  return { start: match[1].length, end: match[0].length }
}

function meaningfulLines(lines) {
  return lines.filter((line) => line.text.trim() !== '')
}

function allSelectedLinesHavePrefix(text, start, end, getPrefix) {
  const lines = meaningfulLines(getSelectedLines(text, start, end).lines)
  return lines.length > 0 && lines.every((line) => Boolean(getPrefix(line.text)))
}

function toggleLinePrefix(text, selectionStart, selectionEnd, options) {
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const { lines } = getSelectedLines(text, start, end)
  const eligibleLines = meaningfulLines(lines)

  if (start === end && lines.length === 1 && lines[0].text.trim() === '') {
    const line = lines[0]
    const indentation = line.text.slice(0, getIndentLength(line.text))
    const insertion = `${indentation}${options.marker}${options.placeholder}`
    const nextText = text.slice(0, line.start) + insertion + text.slice(line.end)
    const placeholderStart = line.start + indentation.length + options.marker.length
    return editResult(nextText, placeholderStart, placeholderStart + options.placeholder.length)
  }

  if (eligibleLines.length === 0) return editResult(text, start, end)

  const shouldRemove = eligibleLines.every((line) => Boolean(options.getPrefix(line.text)))
  const edits = []

  for (const line of eligibleLines) {
    const existing = options.getPrefix(line.text)
    if (shouldRemove && existing) {
      edits.push({
        start: line.start + existing.start,
        end: line.start + existing.end,
        replacement: '',
      })
    } else if (!shouldRemove && !existing) {
      const indentationLength = getIndentLength(line.text)
      edits.push({
        start: line.start + indentationLength,
        end: line.start + indentationLength,
        replacement: options.marker,
      })
    }
  }

  return applyEdits(text, start, end, edits)
}

function getHeadingPrefix(line) {
  const indentationLength = line.match(/^ {0,3}/)?.[0].length ?? 0
  const match = line.slice(indentationLength).match(/^(#{1,6})(?:[ \t]+|$)/)
  if (!match) return null

  return {
    level: match[1].length,
    start: indentationLength,
    end: indentationLength + match[0].length,
  }
}

function assertHeadingLevel(level) {
  if (!Number.isInteger(level) || level < 0 || level > 6) {
    throw new RangeError('Heading level must be an integer between 0 and 6.')
  }
}

function getHeadingLevel(text, start, end) {
  const lines = meaningfulLines(getSelectedLines(text, start, end).lines)
  if (lines.length === 0) return 0

  const levels = new Set(lines.map((line) => getHeadingPrefix(line.text)?.level ?? 0))
  return levels.size === 1 ? levels.values().next().value : null
}

function findLinks(text) {
  const links = []

  for (let open = 0; open < text.length; open += 1) {
    if (text[open] !== '[' || isEscaped(text, open) || text[open - 1] === '!') continue

    let labelEnd = -1
    for (let cursor = open + 1; cursor < text.length && text[cursor] !== '\n'; cursor += 1) {
      if (
        text[cursor] === ']' &&
        !isEscaped(text, cursor) &&
        text[cursor + 1] === '('
      ) {
        labelEnd = cursor
        break
      }
    }
    if (labelEnd === -1) continue

    const destinationStart = labelEnd + 2
    let destinationEnd = -1
    let nestedParentheses = 0
    for (let cursor = destinationStart; cursor < text.length && text[cursor] !== '\n'; cursor += 1) {
      if (isEscaped(text, cursor)) continue
      if (text[cursor] === '(') nestedParentheses += 1
      if (text[cursor] === ')' && nestedParentheses > 0) nestedParentheses -= 1
      else if (text[cursor] === ')' && nestedParentheses === 0) {
        destinationEnd = cursor
        break
      }
    }
    if (destinationEnd === -1) continue

    links.push({
      fullStart: open,
      fullEnd: destinationEnd + 1,
      labelStart: open + 1,
      labelEnd,
      destinationStart,
      destinationEnd,
      rawLabel: text.slice(open + 1, labelEnd),
      rawUrl: text.slice(destinationStart, destinationEnd),
    })
    open = destinationEnd
  }

  return links
}

function unescapeLinkValue(value) {
  return value.replace(/\\([\\\]\(\)])/g, '$1')
}

function escapeLinkLabel(value) {
  return value.replaceAll('\\', '\\\\').replaceAll(']', '\\]')
}

function escapeLinkUrl(value) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
}

function linkContainsSelection(link, start, end) {
  if (start === end) return start > link.fullStart && start < link.fullEnd
  return start >= link.fullStart && end <= link.fullEnd
}

function findLinkAtSelection(text, start, end) {
  return findLinks(text).find((link) => linkContainsSelection(link, start, end)) ?? null
}

function publicLinkData(link) {
  if (!link) return null
  return {
    label: unescapeLinkValue(link.rawLabel),
    url: unescapeLinkValue(link.rawUrl),
    start: link.fullStart,
    end: link.fullEnd,
    labelStart: link.labelStart,
    labelEnd: link.labelEnd,
  }
}

function stripInlineLinks(value) {
  const links = findLinks(value)
  if (links.length === 0) return value

  let nextValue = value
  for (const link of links.reverse()) {
    nextValue =
      nextValue.slice(0, link.fullStart) +
      unescapeLinkValue(link.rawLabel) +
      nextValue.slice(link.fullEnd)
  }
  return nextValue
}

export function getFormattingState(text, selectionStart = 0, selectionEnd = selectionStart) {
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const linkData = publicLinkData(findLinkAtSelection(text, start, end))

  return {
    bold: Boolean(findDelimitedSpan(text, start, end, INLINE_MARKERS.bold)),
    italic: Boolean(findDelimitedSpan(text, start, end, INLINE_MARKERS.italic)),
    code: Boolean(findDelimitedSpan(text, start, end, INLINE_MARKERS.code)),
    list: allSelectedLinesHavePrefix(text, start, end, getListPrefix),
    quote: allSelectedLinesHavePrefix(text, start, end, getQuotePrefix),
    heading: getHeadingLevel(text, start, end),
    link: Boolean(linkData),
    linkData,
  }
}

export function toggleBold(text, selectionStart = 0, selectionEnd = selectionStart, placeholder = INLINE_PLACEHOLDERS.bold) {
  return toggleInline(text, selectionStart, selectionEnd, INLINE_MARKERS.bold, placeholder)
}

export function toggleItalic(text, selectionStart = 0, selectionEnd = selectionStart, placeholder = INLINE_PLACEHOLDERS.italic) {
  return toggleInline(text, selectionStart, selectionEnd, INLINE_MARKERS.italic, placeholder)
}

export function toggleInlineCode(text, selectionStart = 0, selectionEnd = selectionStart, placeholder = INLINE_PLACEHOLDERS.code) {
  return toggleInline(text, selectionStart, selectionEnd, INLINE_MARKERS.code, placeholder)
}

export function toggleList(text, selectionStart = 0, selectionEnd = selectionStart, placeholder = 'Un elemento') {
  return toggleLinePrefix(text, selectionStart, selectionEnd, {
    marker: '- ',
    placeholder,
    getPrefix: getListPrefix,
  })
}

export function toggleQuote(text, selectionStart = 0, selectionEnd = selectionStart, placeholder = 'Una idea para recordar') {
  return toggleLinePrefix(text, selectionStart, selectionEnd, {
    marker: '> ',
    placeholder,
    getPrefix: getQuotePrefix,
  })
}

export function setHeading(text, selectionStart = 0, selectionEnd = selectionStart, level = 0, placeholder = 'Un buen título') {
  assertHeadingLevel(level)
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const { lines } = getSelectedLines(text, start, end)

  if (start === end && lines.length === 1 && lines[0].text.trim() === '' && level > 0) {
    const line = lines[0]
    const insertion = `${'#'.repeat(level)} ${placeholder}`
    const nextText = text.slice(0, line.start) + insertion + text.slice(line.end)
    const placeholderStart = line.start + level + 1
    return editResult(nextText, placeholderStart, placeholderStart + placeholder.length)
  }

  const edits = []
  for (const line of meaningfulLines(lines)) {
    const existing = getHeadingPrefix(line.text)
    const headingIndentationLength = line.text.match(/^ {0,3}/)?.[0].length ?? 0
    const indentationLength = existing?.start ?? headingIndentationLength
    const replacement = level === 0 ? '' : `${'#'.repeat(level)} `

    if (existing) {
      if (existing.level !== level || level === 0) {
        edits.push({
          start: line.start + existing.start,
          end: line.start + existing.end,
          replacement,
        })
      }
    } else if (level > 0) {
      edits.push({
        start: line.start + indentationLength,
        end: line.start + indentationLength,
        replacement,
      })
    }
  }

  return applyEdits(text, start, end, edits)
}

export function toggleHeading(text, selectionStart = 0, selectionEnd = selectionStart, level = 2, placeholder = 'Un buen título') {
  assertHeadingLevel(level)
  if (level === 0) return setHeading(text, selectionStart, selectionEnd, 0, placeholder)

  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const nextLevel = getHeadingLevel(text, start, end) === level ? 0 : level
  return setHeading(text, start, end, nextLevel, placeholder)
}

/**
 * Creates or updates an inline link. When the selection is already inside a
 * link, that whole link is replaced instead of nesting another one.
 *
 * `options` accepts `{ label, url }`. Omitted values preserve the existing
 * link values; for a new link they use the selection and `https://`.
 */
export function setLink(text, selectionStart = 0, selectionEnd = selectionStart, options = {}) {
  const normalizedOptions = typeof options === 'string' ? { url: options } : (options ?? {})
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const existing = findLinkAtSelection(text, start, end)
  const replaceStart = existing?.fullStart ?? start
  const replaceEnd = existing?.fullEnd ?? end
  const selectedText = stripInlineLinks(text.slice(start, end))
  const current = publicLinkData(existing)
  const requestedLabel = normalizedOptions.label ?? current?.label ?? selectedText ?? ''
  const plainLabel = stripInlineLinks(String(requestedLabel)) || 'nombre del enlace'
  const requestedUrl = normalizedOptions.url ?? current?.url ?? 'https://'
  const url = String(requestedUrl || 'https://')
  const markdownLabel = escapeLinkLabel(plainLabel)
  const insertion = `[${markdownLabel}](${escapeLinkUrl(url)})`
  const nextText = text.slice(0, replaceStart) + insertion + text.slice(replaceEnd)

  return editResult(nextText, replaceStart + 1, replaceStart + 1 + markdownLabel.length)
}

export function removeLink(text, selectionStart = 0, selectionEnd = selectionStart) {
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  const existing = findLinkAtSelection(text, start, end)

  if (existing) {
    const label = unescapeLinkValue(existing.rawLabel)
    const nextText = text.slice(0, existing.fullStart) + label + text.slice(existing.fullEnd)
    return editResult(nextText, existing.fullStart, existing.fullStart + label.length)
  }

  if (start !== end) {
    const selectedText = text.slice(start, end)
    const withoutLinks = stripInlineLinks(selectedText)
    if (withoutLinks !== selectedText) {
      const nextText = text.slice(0, start) + withoutLinks + text.slice(end)
      return editResult(nextText, start, start + withoutLinks.length)
    }
  }

  return editResult(text, start, end)
}

export function toggleLink(text, selectionStart = 0, selectionEnd = selectionStart, options = {}) {
  const { start, end } = normalizeSelection(text, selectionStart, selectionEnd)
  return findLinkAtSelection(text, start, end)
    ? removeLink(text, start, end)
    : setLink(text, start, end, options)
}
