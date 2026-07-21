import { renderMarkdown } from './markdown.js'
import { renderMermaidSvg } from './mermaidRenderer.js'

const EXPORT_VARIANTS = new Set(['screen', 'print'])
const EXPORT_FONT_FAMILIES = new Set(['serif', 'sans'])
const DOCUMENT_EXTENSION = /\.(?:md|markdown|txt|html|pdf)$/i
const MERMAID_FENCE = /<pre(?:\s[^>]*)?><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g

const BASE_EXPORT_STYLES = `
:root{color-scheme:light;--paper:#fff;--ink:#211f1c;--muted:#69645d;--line:#d9d6cf;--soft:#f7f6f2;--accent:#c92e28}
*{box-sizing:border-box}
html{background:var(--paper);color:var(--ink);font-family:Georgia,"Times New Roman",serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html.export-font-sans{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body{min-height:100vh;margin:0;background:var(--paper)}
.export-document{width:min(100% - 48px,760px);margin:64px auto;color:var(--ink);font-size:19px;line-height:1.62;overflow-wrap:anywhere}
h1,h2,h3,h4,h5,h6{margin:1.35em 0 .55em;color:var(--ink);line-height:1.12;break-after:avoid-page;page-break-after:avoid;orphans:3;widows:3}
h1{margin-top:0;font-size:48px}h2{font-size:32px}h3{font-size:25px}
p,ul,ol,blockquote,pre,table,figure{margin:0 0 1.25em}
p,li{orphans:3;widows:3}
a{color:var(--accent);text-decoration-thickness:.08em;text-underline-offset:.12em}
img{display:block;max-width:100%;height:auto;margin:1.5em auto;break-inside:avoid;page-break-inside:avoid}
blockquote{padding:.1em 0 .1em 18px;border-left:3px solid var(--accent);color:var(--muted);break-inside:avoid-page;page-break-inside:avoid}
pre{max-width:100%;overflow:auto;padding:18px;border-radius:4px;background:#292723;color:#fff;break-inside:avoid-page;page-break-inside:avoid;white-space:pre-wrap;overflow-wrap:anywhere}
code{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace;font-size:.86em}
pre code{white-space:pre-wrap;word-break:break-word}
table{width:100%;border-collapse:collapse;font:16px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}
thead{display:table-header-group}tfoot{display:table-footer-group}
tr{break-inside:avoid;page-break-inside:avoid}
th,td{padding:10px 12px;border:1px solid var(--line);text-align:left;vertical-align:top}
th{background:var(--soft);font-weight:700}
hr{margin:2.4em 0;border:0;border-top:1px solid var(--line)}
.contains-task-list{padding-left:0}.task-list-item{list-style:none}.task-list-item input{margin-right:.55em;accent-color:var(--accent)}
.footnotes{margin-top:44px;padding-top:20px;border-top:1px solid var(--line);font-size:15px;color:var(--muted)}
.footnotes ol{padding-left:1.5em}.footnote-backref{text-decoration:none}
.mermaid-export{display:grid;place-items:center;max-width:100%;margin:28px 0;overflow:hidden;break-inside:avoid;page-break-inside:avoid}
.mermaid-export svg{display:block;max-width:100%;height:auto}
.print-controls{position:sticky;z-index:10;top:0;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 16px;width:100%;padding:12px 18px;border-bottom:1px solid var(--line);background:rgba(247,246,242,.96);color:var(--muted);font:600 13px/1.4 Inter,ui-sans-serif,system-ui,sans-serif;backdrop-filter:blur(10px)}
.print-controls small{flex-basis:100%;text-align:center;font-size:11px;font-weight:500}
.print-controls button{min-height:38px;padding:0 15px;border:0;border-radius:4px;background:var(--accent);color:#fff;cursor:pointer;font:700 13px Inter,ui-sans-serif,system-ui,sans-serif}
.print-controls button:disabled{cursor:wait;opacity:.55}
.print-controls button:focus-visible{outline:3px solid rgba(201,46,40,.28);outline-offset:2px}
`

const PRINT_EXPORT_STYLES = `
@page{size:A4 portrait;margin:18mm 17mm 20mm}
@media print{
  html,body{width:auto;min-height:0;background:#fff}
  .no-print{display:none!important}
  .export-document{width:auto;max-width:none;margin:0;font-size:11.5pt;line-height:1.55}
  h1{font-size:30pt}h2{font-size:21pt}h3{font-size:16pt}
  img{width:auto;max-width:100%;max-height:245mm;object-fit:contain}
  .mermaid-export{max-height:245mm}
  .mermaid-export svg{width:auto;max-width:100%;max-height:245mm;object-fit:contain}
  pre{overflow:visible;font-size:9pt}
  a[href^="http"]{overflow-wrap:anywhere}
}
`

const PRINT_READY_SCRIPT = `<script>
(() => {
  const root = document.documentElement
  const status = document.querySelector('[data-linea-print-status]')
  const button = document.querySelector('[data-linea-print-button]')
  const warningCount = Number.parseInt(root.dataset.exportWarnings || '0', 10) || 0
  const waitForImage = async (image) => {
    const loaded = image.complete
      ? image.naturalWidth > 0
      : await new Promise((resolve) => {
          image.addEventListener('load', () => resolve(true), { once: true })
          image.addEventListener('error', () => resolve(false), { once: true })
        })
    if (!loaded) return false
    if (typeof image.decode === 'function') {
      try {
        await image.decode()
      } catch {
        return false
      }
    }
    return image.naturalWidth > 0
  }
  const imagePromises = Array.from(document.images).map(waitForImage)
  const fontPromise = document.fonts?.ready?.then(() => true, () => false) ?? Promise.resolve(true)
  const resources = Promise.all([...imagePromises, fontPromise])
  const timeout = new Promise((resolve) => window.setTimeout(() => resolve('timeout'), 6000))

  Promise.race([resources, timeout]).then((result) => {
    const timedOut = result === 'timeout'
    const failed = Array.isArray(result) && result.includes(false)
    const partial = timedOut || failed || warningCount > 0
    root.dataset.exportReady = partial ? 'partial' : 'true'
    if (status) status.textContent = timedOut
      ? 'Algunos recursos siguen cargando. Puedes continuar o volver a intentarlo.'
      : failed
        ? 'Algún recurso no se ha podido cargar. Revisa el documento antes de guardarlo.'
        : warningCount > 0
          ? warningCount === 1
            ? 'Un diagrama no se ha podido dibujar y se conserva como código. Revisa el documento.'
            : warningCount + ' diagramas no se han podido dibujar y se conservan como código. Revisa el documento.'
          : 'Documento listo para imprimir o guardar como PDF.'
    if (button) button.disabled = false
    window.dispatchEvent(new CustomEvent('linea-export-ready', { detail: { timedOut, failed, warningCount, partial } }))
  })

  button?.addEventListener('click', () => window.print())
})()
</script>`

function decodeHtmlEntities(value) {
  return String(value ?? '').replace(/&(?:#(\d+)|#x([\da-f]+)|amp|lt|gt|quot|apos|#39);/gi, (entity, decimal, hexadecimal) => {
    if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10))
    if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16))
    return ({
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'",
      '&#39;': "'",
    })[entity.toLowerCase()] ?? entity
  })
}

export function escapeDocumentText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

export function documentTitleFromFilename(filename, fallback = 'Documento') {
  const basename = String(filename ?? '').trim().split(/[\\/]/).pop() ?? ''
  const title = basename.replace(DOCUMENT_EXTENSION, '').trim()
  return title || String(fallback ?? '').trim() || 'Documento'
}

export function exportFilenameFor(filename, extension) {
  const normalizedExtension = String(extension ?? '').trim().replace(/^\.+/, '').toLowerCase()
  if (!/^[a-z0-9]+$/.test(normalizedExtension)) {
    throw new TypeError('La extensión de exportación no es válida.')
  }

  return `${documentTitleFromFilename(filename)}.${normalizedExtension}`
}

export async function renderExportBody(markdown, options = {}) {
  const renderDiagram = options.renderDiagram ?? renderMermaidSvg
  const diagramTimeoutMs = Number.isFinite(options.diagramTimeoutMs)
    ? Math.max(0, options.diagramTimeoutMs)
    : 6000
  const diagramBudgetMs = Number.isFinite(options.diagramBudgetMs)
    ? Math.max(0, options.diagramBudgetMs)
    : 12000
  const diagramDeadline = Date.now() + diagramBudgetMs
  const renderedMarkdown = renderMarkdown(markdown)
  const rendered = options.eagerImages === true
    ? renderedMarkdown.replace(/(<img\b[^>]*\s)loading="lazy"/g, '$1loading="eager"')
    : renderedMarkdown
  const matches = [...rendered.matchAll(MERMAID_FENCE)]
  if (!matches.length) return rendered

  let cursor = 0
  let body = ''
  for (const match of matches) {
    body += rendered.slice(cursor, match.index)
    try {
      const remainingBudgetMs = Math.max(0, diagramDeadline - Date.now())
      if (remainingBudgetMs === 0) {
        throw new Error('Se ha agotado el tiempo total para generar los diagramas.')
      }
      let timeoutId
      const rendering = Promise.resolve().then(() => renderDiagram(decodeHtmlEntities(match[1]), 'linea-export'))
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('El diagrama ha tardado demasiado en generarse.')),
          Math.min(diagramTimeoutMs, remainingBudgetMs),
        )
      })
      const result = await Promise.race([rendering, timeout]).finally(() => clearTimeout(timeoutId))
      const svg = typeof result === 'string' ? result : result?.svg
      if (!svg) throw new Error('El diagrama no produjo una imagen SVG.')
      body += `<figure class="mermaid-export" aria-label="Diagrama Mermaid">${svg}</figure>`
    } catch (error) {
      options.onWarning?.({ type: 'mermaid', source: decodeHtmlEntities(match[1]), error })
      body += match[0]
    }
    cursor = match.index + match[0].length
  }

  return body + rendered.slice(cursor)
}

export function createStandaloneExportDocument({
  bodyHtml = '',
  title = 'Documento',
  variant = 'screen',
  language = 'es',
  warningCount = 0,
  fontFamily = 'serif',
} = {}) {
  if (!EXPORT_VARIANTS.has(variant)) {
    throw new TypeError(`Variante de exportación no válida: ${variant}`)
  }

  const printable = variant === 'print'
  const controls = printable
    ? '<aside class="print-controls no-print" aria-label="Opciones de exportación"><span role="status" aria-live="polite" data-linea-print-status>Preparando el documento…</span><button type="button" data-linea-print-button disabled>Imprimir / Guardar PDF</button><small>Si no se abre el diálogo, abre Línea en Safari, Chrome o el navegador del sistema.</small></aside>'
    : ''
  const script = printable ? PRINT_READY_SCRIPT : ''
  const styles = printable ? `${BASE_EXPORT_STYLES}\n${PRINT_EXPORT_STYLES}` : BASE_EXPORT_STYLES
  const normalizedWarningCount = Number.isFinite(warningCount) ? Math.max(0, Math.trunc(warningCount)) : 0
  const normalizedFontFamily = EXPORT_FONT_FAMILIES.has(fontFamily) ? fontFamily : 'serif'

  return `<!doctype html><html class="export-font-${normalizedFontFamily}" lang="${escapeDocumentText(language)}"${printable ? ` data-export-ready="false" data-export-warnings="${normalizedWarningCount}"` : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeDocumentText(title)}</title><style>${styles}</style></head><body class="export-page export-page--${variant}">${controls}<main class="export-document">${String(bodyHtml ?? '')}</main>${script}</body></html>`
}

export async function renderStandaloneExport({
  markdown = '',
  filename = 'documento.md',
  title = documentTitleFromFilename(filename),
  variant = 'screen',
  language = 'es',
  renderDiagram,
  diagramTimeoutMs,
  diagramBudgetMs,
  onWarning,
  fontFamily = 'serif',
} = {}) {
  const warnings = []
  const bodyHtml = await renderExportBody(markdown, {
    renderDiagram,
    eagerImages: variant === 'print',
    diagramTimeoutMs,
    diagramBudgetMs,
    onWarning: (warning) => {
      warnings.push(warning)
      onWarning?.(warning)
    },
  })
  return createStandaloneExportDocument({ bodyHtml, title, variant, language, warningCount: warnings.length, fontFamily })
}
