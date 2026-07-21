import MarkdownIt from 'markdown-it'
import { getInitialFrontmatterRange } from './richMarkdownCompatibility.js'

export const TABLE_LIMITS = Object.freeze({
  columns: Object.freeze({ min: 1, max: 12 }),
  bodyRows: Object.freeze({ min: 1, max: 50 }),
  cellLength: 160,
})

export const MERMAID_LIMITS = Object.freeze({
  labelLength: 160,
  flowchartSteps: Object.freeze({ min: 2, max: 20 }),
  participants: Object.freeze({ min: 2, max: 12 }),
  messages: Object.freeze({ min: 1, max: 30 }),
  timelineEvents: Object.freeze({ min: 2, max: 30 }),
  pieSlices: Object.freeze({ min: 2, max: 20 }),
})

const DEFAULT_TABLE_SPEC = Object.freeze({ columns: 3, bodyRows: 2 })
const FLOW_DIRECTIONS = new Set(['TD', 'LR'])
const MESSAGE_KINDS = new Set(['message', 'reply'])
const blockParser = new MarkdownIt({ html: false, linkify: false, typographer: false })
const MERMAID_SAFE_PUNCTUATION = Object.freeze({
  '&': '＆',
  '<': '‹',
  '>': '›',
  '"': '”',
  "'": '’',
  ':': '：',
  '#': '＃',
  ';': '；',
  '`': 'ʼ',
  '{': '｛',
  '}': '｝',
  '[': '［',
  ']': '］',
  '(': '（',
  ')': '）',
})

function boundedInteger(value, label, limits, fallback) {
  const candidate = value === undefined ? fallback : Number(value)
  if (!Number.isFinite(candidate) || !Number.isInteger(candidate)) {
    throw new TypeError(`${label} debe ser un número entero.`)
  }
  if (candidate < limits.min || candidate > limits.max) {
    throw new RangeError(`${label} debe estar entre ${limits.min} y ${limits.max}.`)
  }
  return candidate
}

function boundedList(value, label, limits, fallback) {
  const candidate = value === undefined ? fallback : value
  if (!Array.isArray(candidate)) throw new TypeError(`${label} debe ser una lista.`)
  if (candidate.length < limits.min || candidate.length > limits.max) {
    throw new RangeError(`${label} debe contener entre ${limits.min} y ${limits.max} elementos.`)
  }
  return candidate
}

function singleLine(value, fallback = '') {
  const normalized = String(value ?? '')
    .replaceAll('\0', '')
    .replace(/\r\n?|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MERMAID_LIMITS.labelLength)
  return normalized || fallback
}

function escapeTableCell(value, fallback) {
  const normalized = String(value ?? '')
    .replaceAll('\0', '')
    .replace(/\r\n?|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TABLE_LIMITS.cellLength)
  const content = normalized || fallback
  return content.replaceAll('\\', '\\\\').replaceAll('|', '\\|')
}

function escapeMermaidText(value, fallback) {
  return singleLine(value, fallback)
    .replace(/[&<>"':#;`{}\[\]()]/g, (character) => MERMAID_SAFE_PUNCTUATION[character])
}

function requiredMermaidText(value, message) {
  const normalized = singleLine(value)
  if (!normalized) throw new TypeError(message)
  return normalized.replace(/[&<>"':#;`{}\[\]()]/g, (character) => MERMAID_SAFE_PUNCTUATION[character])
}

export function reorderMermaidItems(items, fromIndex, toIndex) {
  if (!Array.isArray(items)) throw new TypeError('Los elementos del diagrama deben ser una lista.')
  const from = Number(fromIndex)
  const to = Number(toIndex)
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) {
    return items
  }
  const reordered = [...items]
  const [moved] = reordered.splice(from, 1)
  reordered.splice(to, 0, moved)
  return reordered
}

export function getMermaidFlowchartStepIndex(identifier, stepCount) {
  const match = String(identifier ?? '').match(/(?:^|-)n(\d+)(?:-|$)/)
  const index = match ? Number(match[1]) - 1 : -1
  return Number.isInteger(index) && index >= 0 && index < Number(stepCount) ? index : null
}

function normalizeSelection(text, selectionStart = 0, selectionEnd = selectionStart) {
  const length = text.length
  const first = Math.min(length, Math.max(0, Number.isFinite(selectionStart) ? Math.trunc(selectionStart) : 0))
  const second = Math.min(length, Math.max(0, Number.isFinite(selectionEnd) ? Math.trunc(selectionEnd) : first))
  return first <= second ? { start: first, end: second } : { start: second, end: first }
}

function markdownLines(source) {
  const lines = []
  let start = 0
  for (let index = 0; index <= source.length; index += 1) {
    if (index !== source.length && source[index] !== '\n') continue
    const end = index
    lines.push({
      start,
      end,
      text: source.slice(start, end).replace(/\r$/, ''),
    })
    start = index + 1
  }
  return lines
}

function lineIndexAt(lines, position) {
  const target = Math.max(0, position)
  const index = lines.findIndex((line) => target >= line.start && target <= line.end)
  return index < 0 ? Math.max(0, lines.length - 1) : index
}

function safeBlockInsertionPoint(source, position) {
  const frontmatter = getInitialFrontmatterRange(source)
  if (frontmatter && position >= frontmatter.start && position <= frontmatter.end) {
    return frontmatter.end
  }
  const lines = markdownLines(source)
  const targetLine = lineIndexAt(lines, position)
  const containingBlocks = blockParser.parse(source, {})
    .filter((token) => token.map && targetLine >= token.map[0] && targetLine < token.map[1])
    .sort((first, second) => first.level - second.level || first.map[0] - second.map[0])
  if (containingBlocks.length) return lines[containingBlocks[0].map[0]]?.start ?? 0
  return lines[targetLine]?.start ?? source.length
}

function surroundBlock(source, insertionPoint, block) {
  const prefix = source.slice(0, insertionPoint)
  const suffix = source.slice(insertionPoint)
  const beforeBreak = !prefix || prefix.endsWith('\n\n') ? '' : prefix.endsWith('\n') ? '\n' : '\n\n'
  const afterBreak = !suffix || suffix.startsWith('\n\n') ? '' : suffix.startsWith('\n') ? '\n' : '\n\n'
  return `${beforeBreak}${block}${afterBreak}`
}

function normalizeTableSpec(spec = {}) {
  const columns = boundedInteger(spec.columns, 'El número de columnas', TABLE_LIMITS.columns, DEFAULT_TABLE_SPEC.columns)
  const bodyRows = boundedInteger(spec.bodyRows, 'El número de filas', TABLE_LIMITS.bodyRows, DEFAULT_TABLE_SPEC.bodyRows)
  const suppliedHeaders = spec.headers === undefined ? [] : spec.headers
  if (!Array.isArray(suppliedHeaders)) throw new TypeError('Las cabeceras deben ser una lista.')
  const headers = Array.from({ length: columns }, (_, index) =>
    escapeTableCell(suppliedHeaders[index], `Columna ${index + 1}`))
  const cellPlaceholder = escapeTableCell(spec.cellPlaceholder, 'Dato')
  return { columns, bodyRows, headers, cellPlaceholder }
}

export function createTableMarkdown(spec = {}) {
  const { columns, bodyRows, headers, cellPlaceholder } = normalizeTableSpec(spec)
  const header = `| ${headers.join(' | ')} |`
  const separator = `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`
  const row = `| ${Array.from({ length: columns }, () => cellPlaceholder).join(' | ')} |`
  return [header, separator, ...Array.from({ length: bodyRows }, () => row)].join('\n')
}

export function insertConfiguredTable(text, selectionStart = 0, selectionEnd = selectionStart, spec = {}) {
  const source = String(text ?? '')
  const { start } = normalizeSelection(source, selectionStart, selectionEnd)
  const insertionPoint = safeBlockInsertionPoint(source, start)
  const table = createTableMarkdown(spec)
  const insertion = surroundBlock(source, insertionPoint, table)
  const nextText = source.slice(0, insertionPoint) + insertion + source.slice(insertionPoint)
  const firstHeader = table.slice(2, table.indexOf(' |'))
  const headerOffset = insertion.indexOf(firstHeader)
  const nextStart = insertionPoint + Math.max(0, headerOffset)
  return {
    text: nextText,
    selectionStart: nextStart,
    selectionEnd: nextStart + firstHeader.length,
  }
}

export function insertConfiguredMermaid(text, selectionStart = 0, selectionEnd = selectionStart, source = '') {
  const markdown = String(text ?? '')
  const { start } = normalizeSelection(markdown, selectionStart, selectionEnd)
  const insertionPoint = safeBlockInsertionPoint(markdown, start)
  const definition = String(source ?? '').replaceAll('\0', '').trim()
  if (!definition) throw new TypeError('El diagrama necesita contenido Mermaid.')
  const block = `\`\`\`mermaid\n${definition}\n\`\`\``
  const insertion = surroundBlock(markdown, insertionPoint, block)
  const nextText = markdown.slice(0, insertionPoint) + insertion + markdown.slice(insertionPoint)
  const sourceOffset = insertion.indexOf(definition)
  return {
    text: nextText,
    selectionStart: insertionPoint + sourceOffset,
    selectionEnd: insertionPoint + sourceOffset + definition.length,
  }
}

const DEFAULT_MERMAID_SPECS = Object.freeze({
  flowchart: Object.freeze({
    type: 'flowchart',
    direction: 'TD',
    steps: Object.freeze(['Idea', 'Borrador', 'Publicación']),
  }),
  sequence: Object.freeze({
    type: 'sequence',
    participants: Object.freeze(['Usuario', 'Línea']),
    messages: Object.freeze([
      Object.freeze({ from: 0, to: 1, text: 'Crear documento', kind: 'message' }),
      Object.freeze({ from: 1, to: 0, text: 'Documento listo', kind: 'reply' }),
    ]),
  }),
  timeline: Object.freeze({
    type: 'timeline',
    title: 'Plan de publicación',
    events: Object.freeze([
      Object.freeze({ period: 'Idea', text: 'Definir el enfoque' }),
      Object.freeze({ period: 'Borrador', text: 'Escribir y revisar' }),
      Object.freeze({ period: 'Publicación', text: 'Compartir el resultado' }),
    ]),
  }),
  pie: Object.freeze({
    type: 'pie',
    title: 'Distribución del trabajo',
    showData: true,
    slices: Object.freeze([
      Object.freeze({ label: 'Investigación', value: 30 }),
      Object.freeze({ label: 'Escritura', value: 50 }),
      Object.freeze({ label: 'Revisión', value: 20 }),
    ]),
  }),
})

export function getDefaultMermaidSpec(type = 'flowchart') {
  const source = DEFAULT_MERMAID_SPECS[type]
  if (!source) throw new TypeError('El tipo de diagrama no es compatible.')
  if (type === 'flowchart') return { ...source, steps: [...source.steps] }
  if (type === 'sequence') {
    return {
      ...source,
      participants: [...source.participants],
      messages: source.messages.map((message) => ({ ...message })),
    }
  }
  if (type === 'timeline') return { ...source, events: source.events.map((event) => ({ ...event })) }
  return { ...source, slices: source.slices.map((slice) => ({ ...slice })) }
}

function createFlowchartSource(spec) {
  const steps = boundedList(spec.steps, 'El diagrama de flujo', MERMAID_LIMITS.flowchartSteps, DEFAULT_MERMAID_SPECS.flowchart.steps)
  const direction = FLOW_DIRECTIONS.has(spec.direction) ? spec.direction : DEFAULT_MERMAID_SPECS.flowchart.direction
  const lines = [`flowchart ${direction}`]
  steps.forEach((step, index) => {
    const label = requiredMermaidText(
      typeof step === 'object' ? step?.label : step,
      `Escribe un nombre para el paso ${index + 1}.`,
    )
    lines.push(`  n${index + 1}["${label}"]`)
  })
  for (let index = 1; index < steps.length; index += 1) lines.push(`  n${index} --> n${index + 1}`)
  return lines.join('\n')
}

function participantIndex(value, participantCount, label) {
  const index = Number(value)
  if (!Number.isInteger(index) || index < 0 || index >= participantCount) {
    throw new RangeError(`${label} debe identificar un participante existente.`)
  }
  return index
}

function createSequenceSource(spec) {
  const participants = boundedList(spec.participants, 'La lista de participantes', MERMAID_LIMITS.participants, DEFAULT_MERMAID_SPECS.sequence.participants)
  const messages = boundedList(spec.messages, 'La lista de mensajes', MERMAID_LIMITS.messages, DEFAULT_MERMAID_SPECS.sequence.messages)
  const lines = ['sequenceDiagram']
  participants.forEach((participant, index) => {
    const label = requiredMermaidText(
      typeof participant === 'object' ? participant?.label : participant,
      `Escribe el nombre del participante ${index + 1}.`,
    )
    lines.push(`  participant p${index + 1} as ${label}`)
  })
  messages.forEach((message, index) => {
    const from = participantIndex(message?.from, participants.length, `El origen del mensaje ${index + 1}`)
    const to = participantIndex(message?.to, participants.length, `El destino del mensaje ${index + 1}`)
    const arrow = MESSAGE_KINDS.has(message?.kind) && message.kind === 'reply' ? '-->>' : '->>'
    const text = requiredMermaidText(message?.text, `Escribe el texto del mensaje ${index + 1}.`)
    lines.push(`  p${from + 1}${arrow}p${to + 1}: ${text}`)
  })
  return lines.join('\n')
}

function createTimelineSource(spec) {
  const events = boundedList(spec.events, 'La cronología', MERMAID_LIMITS.timelineEvents, DEFAULT_MERMAID_SPECS.timeline.events)
  const title = escapeMermaidText(spec.title, DEFAULT_MERMAID_SPECS.timeline.title)
  const lines = ['timeline', `  title ${title}`]
  events.forEach((event, index) => {
    const period = requiredMermaidText(event?.period, `Escribe una etapa o fecha para el evento ${index + 1}.`)
    const text = requiredMermaidText(event?.text, `Escribe una descripción para el evento ${index + 1}.`)
    lines.push(`  ${period} : ${text}`)
  })
  return lines.join('\n')
}

function createPieSource(spec) {
  const slices = boundedList(spec.slices, 'El gráfico circular', MERMAID_LIMITS.pieSlices, DEFAULT_MERMAID_SPECS.pie.slices)
  const title = escapeMermaidText(spec.title, DEFAULT_MERMAID_SPECS.pie.title)
  const lines = [spec.showData === false ? 'pie' : 'pie showData', `  title ${title}`]
  slices.forEach((slice, index) => {
    const label = requiredMermaidText(slice?.label, `Escribe un nombre para la categoría ${index + 1}.`)
    const value = Number(slice?.value)
    if (!Number.isFinite(value) || value <= 0 || value > 1_000_000_000) {
      throw new RangeError(`El valor de la categoría ${index + 1} debe ser mayor que cero.`)
    }
    lines.push(`  "${label}" : ${value}`)
  })
  return lines.join('\n')
}

export function createMermaidSource(spec = getDefaultMermaidSpec('flowchart')) {
  if (!spec || typeof spec !== 'object') throw new TypeError('La configuración del diagrama no es válida.')
  if (spec.type === 'flowchart') return createFlowchartSource(spec)
  if (spec.type === 'sequence') return createSequenceSource(spec)
  if (spec.type === 'timeline') return createTimelineSource(spec)
  if (spec.type === 'pie') return createPieSource(spec)
  throw new TypeError('El tipo de diagrama no es compatible.')
}
