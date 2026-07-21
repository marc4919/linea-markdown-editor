import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'

const UNSAFE_PROTOCOL = /^(?:javascript|vbscript|file|data):/i
const EXTERNAL_WEB_URL = /^(?:https?:)?\/\//i

const SOURCE_MAPPED_BLOCKS = new Set([
  'blockquote_open',
  'bullet_list_open',
  'heading_open',
  'hr',
  'list_item_open',
  'ordered_list_open',
  'paragraph_open',
  'table_open',
])

const markdownRenderer = new MarkdownIt({
  breaks: false,
  html: false,
  linkify: false,
  typographer: false,
})

markdownRenderer.use(taskLists, { enabled: false, label: false })
markdownRenderer.use(footnote)

// Línea uses ++text++ as an explicit, HTML-free underline extension. This is
// also the syntax emitted by the rich editor, so source and reading stay equal.
markdownRenderer.inline.ruler.before('emphasis', 'linea_underline', (state, silent) => {
  const start = state.pos
  if (state.src.slice(start, start + 2) !== '++') return false
  const end = state.src.indexOf('++', start + 2)
  if (end < 0 || end === start + 2 || state.src.slice(start + 2, end).includes('\n')) return false

  if (!silent) {
    const open = state.push('underline_open', 'u', 1)
    open.markup = '++'
    const children = []
    state.md.inline.parse(state.src.slice(start + 2, end), state.md, state.env, children)
    state.tokens.push(...children)
    const close = state.push('underline_close', 'u', -1)
    close.markup = '++'
  }
  state.pos = end + 2
  return true
})

// Preserve Línea's existing compact paragraph output. Browsers collapse this
// space exactly as they collapsed the previous renderer's joined lines.
markdownRenderer.renderer.rules.softbreak = () => ' '

// markdown-it already rejects script-like links. The extra protocol guard also
// rejects data images, which markdown-it otherwise permits for a few MIME types.
const markdownItValidateLink = markdownRenderer.validateLink.bind(markdownRenderer)
markdownRenderer.validateLink = (url) =>
  markdownItValidateLink(url) && !UNSAFE_PROTOCOL.test(url.trim())

const defaultLinkOpen = markdownRenderer.renderer.rules.link_open
markdownRenderer.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  const token = tokens[index]
  const href = token.attrGet('href') ?? ''

  if (EXTERNAL_WEB_URL.test(href)) {
    const rel = new Set((token.attrGet('rel') ?? '').split(/\s+/).filter(Boolean))
    rel.add('noopener')
    rel.add('noreferrer')
    token.attrSet('target', '_blank')
    token.attrSet('rel', [...rel].join(' '))
  }

  return defaultLinkOpen
    ? defaultLinkOpen(tokens, index, options, env, renderer)
    : renderer.renderToken(tokens, index, options)
}

const defaultImage = markdownRenderer.renderer.rules.image
markdownRenderer.renderer.rules.image = (tokens, index, options, env, renderer) => {
  tokens[index].attrSet('loading', 'lazy')
  return defaultImage(tokens, index, options, env, renderer)
}

const addSourceLineToPre = (html, token) => {
  const sourceLine = token.meta?.lineaSourceLine
  return sourceLine ? html.replace('<pre', `<pre data-source-line="${sourceLine}"`) : html
}

const defaultFence = markdownRenderer.renderer.rules.fence
markdownRenderer.renderer.rules.fence = (tokens, index, options, env, renderer) =>
  addSourceLineToPre(defaultFence(tokens, index, options, env, renderer), tokens[index])

const defaultCodeBlock = markdownRenderer.renderer.rules.code_block
markdownRenderer.renderer.rules.code_block = (tokens, index, options, env, renderer) =>
  addSourceLineToPre(defaultCodeBlock(tokens, index, options, env, renderer), tokens[index])

const addTaskItemCompatibilityClass = (tokens) => {
  for (const token of tokens) {
    const classes = (token.attrGet('class') ?? '').split(/\s+/).filter(Boolean)
    if (classes.includes('task-list-item') && !classes.includes('task-item')) {
      token.attrSet('class', [...classes, 'task-item'].join(' '))
    }
  }
}

const addSourceLines = (tokens) => {
  for (const token of tokens) {
    if (!token.map || token.map[0] < 0) continue

    const sourceLine = String(token.map[0] + 1)
    if (token.type === 'fence' || token.type === 'code_block') {
      token.meta = { ...token.meta, lineaSourceLine: sourceLine }
    } else if (SOURCE_MAPPED_BLOCKS.has(token.type)) {
      token.attrSet('data-source-line', sourceLine)
    }
  }
}

export function renderMarkdown(markdown, options = {}) {
  const environment = {}
  const tokens = markdownRenderer.parse(String(markdown ?? ''), environment)

  addTaskItemCompatibilityClass(tokens)
  if (options?.sourceMap === true) addSourceLines(tokens)

  const html = markdownRenderer.renderer.render(tokens, markdownRenderer.options, environment)
  return html.endsWith('\n') ? html.slice(0, -1) : html
}

function inlineVisibleText(children = []) {
  return children.map((token) => {
    if (token.type === 'text' || token.type === 'code_inline') return token.content
    if (token.type === 'image') return token.content
    if (token.type === 'softbreak' || token.type === 'hardbreak') return ' '
    return ''
  }).join('')
}

export function extractMarkdownText(markdown) {
  const tokens = markdownRenderer.parse(String(markdown ?? ''), {})
  const blocks = []

  for (const token of tokens) {
    if (token.type === 'inline') {
      const text = inlineVisibleText(token.children)
      if (text.trim()) blocks.push(text)
      continue
    }
    if (token.type === 'code_block') blocks.push(token.content)
    if (token.type === 'fence' && token.info.trim().toLowerCase() !== 'mermaid') blocks.push(token.content)
  }

  return blocks.join('\n').replace(/\u00a0/g, ' ')
}
