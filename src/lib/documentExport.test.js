import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createStandaloneExportDocument,
  documentTitleFromFilename,
  escapeDocumentText,
  exportFilenameFor,
  renderExportBody,
  renderStandaloneExport,
} from './documentExport.js'

test('obtiene un título editorial a partir del nombre Markdown', () => {
  assert.equal(documentTitleFromFilename('ideas.md'), 'ideas')
  assert.equal(documentTitleFromFilename('  notas finales.markdown  '), 'notas finales')
  assert.equal(documentTitleFromFilename('/documentos/ensayo.txt'), 'ensayo')
  assert.equal(documentTitleFromFilename('informe.pdf'), 'informe')
  assert.equal(documentTitleFromFilename(''), 'Documento')
  assert.equal(documentTitleFromFilename('.md', 'Sin título'), 'Sin título')
})

test('genera nombres de exportación estables y valida la extensión', () => {
  assert.equal(exportFilenameFor('ensayo.md', 'html'), 'ensayo.html')
  assert.equal(exportFilenameFor('ensayo.v2.markdown', '.PDF'), 'ensayo.v2.pdf')
  assert.equal(exportFilenameFor('', 'pdf'), 'Documento.pdf')
  assert.throws(() => exportFilenameFor('ensayo.md', '../pdf'), /extensión de exportación/)
})

test('escapa metadatos insertados en el documento autónomo', () => {
  assert.equal(escapeDocumentText('Ideas & <b>"hoy"</b>'), 'Ideas &amp; &lt;b&gt;&quot;hoy&quot;&lt;/b&gt;')

  const html = createStandaloneExportDocument({
    bodyHtml: '<p>Contenido seguro</p>',
    title: 'Ideas </title><script>alert(1)</script>',
    language: 'es"><script>',
  })

  assert.match(html, /<title>Ideas &lt;\/title&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/title>/)
  assert.match(html, /<html lang="es&quot;&gt;&lt;script&gt;">/)
  assert.doesNotMatch(html, /<title>Ideas <\/title><script>/)
})

test('renderiza el mismo Markdown avanzado que la vista de lectura', async () => {
  const body = await renderExportBody([
    '# Documento',
    '',
    '- [x] Revisado',
    '',
    '| Campo | Valor |',
    '| --- | --- |',
    '| Estado | Listo |',
    '',
    'Texto con nota[^1].',
    '',
    '[^1]: Detalle final.',
  ].join('\n'))

  assert.match(body, /<h1>Documento<\/h1>/)
  assert.match(body, /class="task-list-item task-item"/)
  assert.match(body, /<table>/)
  assert.match(body, /<section class="footnotes">/)
})

test('permite solicitar imágenes eager para que la impresión espere también las que quedan fuera de pantalla', async () => {
  const screenBody = await renderExportBody('![Portada](https://example.com/portada.jpg)')
  const printBody = await renderExportBody('![Portada](https://example.com/portada.jpg)', { eagerImages: true })

  assert.match(screenBody, /loading="lazy"/)
  assert.match(printBody, /loading="eager"/)
  assert.doesNotMatch(printBody, /loading="lazy"/)
})

test('sustituye Mermaid por SVG y decodifica el código antes de dibujarlo', async () => {
  const calls = []
  const body = await renderExportBody('```mermaid\nflowchart LR\n  A[Uno & dos] --> B[\"Fin\"]\n```', {
    renderDiagram: async (source, prefix) => {
      calls.push({ source, prefix })
      return { svg: '<svg role="img"><text>Diagrama</text></svg>' }
    },
  })

  assert.deepEqual(calls, [{
    source: 'flowchart LR\n  A[Uno & dos] --> B["Fin"]\n',
    prefix: 'linea-export',
  }])
  assert.match(body, /^<figure class="mermaid-export" aria-label="Diagrama Mermaid"><svg/)
  assert.doesNotMatch(body, /language-mermaid/)
})

test('conserva únicamente los diagramas Mermaid que no se pueden generar', async () => {
  let attempt = 0
  const warnings = []
  const body = await renderExportBody([
    '```mermaid',
    'flowchart LR',
    '  A --> B',
    '```',
    '',
    '```mermaid',
    'diagrama inválido',
    '```',
  ].join('\n'), {
    renderDiagram: async () => {
      attempt += 1
      if (attempt === 2) throw new Error('Mermaid inválido')
      return { svg: '<svg data-ok="true"></svg>' }
    },
    onWarning: (warning) => warnings.push(warning),
  })

  assert.equal(attempt, 2)
  assert.equal(warnings.length, 1)
  assert.equal(warnings[0].type, 'mermaid')
  assert.match(warnings[0].source, /diagrama inválido/)
  assert.match(body, /<svg data-ok="true"><\/svg>/)
  assert.match(body, /<pre><code class="language-mermaid">diagrama inválido/)
})

test('limita la espera de Mermaid y conserva el bloque al agotar el tiempo', async () => {
  const warnings = []
  const body = await renderExportBody('```mermaid\nflowchart LR\n  A --> B\n```', {
    diagramTimeoutMs: 5,
    renderDiagram: () => new Promise(() => {}),
    onWarning: (warning) => warnings.push(warning),
  })

  assert.match(body, /<pre><code class="language-mermaid">/)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].error.message, /tardado demasiado/)
})

test('limita también el presupuesto total de varios diagramas Mermaid', async () => {
  const warnings = []
  let attempts = 0
  const markdown = [
    '```mermaid',
    'flowchart LR',
    '  A --> B',
    '```',
    '',
    '```mermaid',
    'flowchart LR',
    '  C --> D',
    '```',
  ].join('\n')
  const body = await renderExportBody(markdown, {
    diagramTimeoutMs: 50,
    diagramBudgetMs: 5,
    renderDiagram: () => {
      attempts += 1
      return new Promise(() => {})
    },
    onWarning: (warning) => warnings.push(warning),
  })

  assert.equal(attempts, 1)
  assert.equal(warnings.length, 2)
  assert.match(warnings[1].error.message, /tiempo total/)
  assert.equal((body.match(/language-mermaid/g) ?? []).length, 2)
})

test('la variante de pantalla es autónoma y no añade controles de impresión', () => {
  const html = createStandaloneExportDocument({
    bodyHtml: '<h1>Ensayo</h1>',
    title: 'Ensayo',
    variant: 'screen',
  })

  assert.match(html, /^<!doctype html><html lang="es"><head>/)
  assert.match(html, /<body class="export-page export-page--screen">/)
  assert.match(html, /<main class="export-document"><h1>Ensayo<\/h1><\/main>/)
  assert.doesNotMatch(html, /data-linea-print-button|@page/)
})

test('la variante imprimible configura A4, paginación y controles no imprimibles', () => {
  const html = createStandaloneExportDocument({
    bodyHtml: '<table><thead><tr><th>A</th></tr></thead></table>',
    title: 'Informe',
    variant: 'print',
    warningCount: 2,
  })

  assert.match(html, /<html lang="es" data-export-ready="false" data-export-warnings="2">/)
  assert.match(html, /@page\{size:A4 portrait;margin:18mm 17mm 20mm\}/)
  assert.match(html, /img\{width:auto;max-width:100%;max-height:245mm;object-fit:contain\}/)
  assert.match(html, /\.mermaid-export svg\{width:auto;max-width:100%;max-height:245mm;object-fit:contain\}/)
  assert.match(html, /thead\{display:table-header-group\}/)
  assert.match(html, /tr\{break-inside:avoid;page-break-inside:avoid\}/)
  assert.match(html, /\.no-print\{display:none!important\}/)
  assert.match(html, /data-linea-print-status>Preparando el documento…/)
  assert.match(html, /data-linea-print-button disabled>Imprimir \/ Guardar PDF/)
  assert.match(html, /abre Línea en Safari, Chrome o el navegador del sistema/)
  assert.match(html, /new CustomEvent\('linea-export-ready'/)
  assert.match(html, /result\.includes\(false\)/)
  assert.match(html, /typeof image\.decode === 'function'/)
  assert.match(html, /warningCount > 0/)
  assert.match(html, /detail: \{ timedOut, failed, warningCount, partial \}/)
  assert.match(html, /window\.print\(\)/)
})

test('renderStandaloneExport compone cuerpo y documento con un solo renderizado', async () => {
  let diagrams = 0
  const html = await renderStandaloneExport({
    markdown: '# Informe\n\n```mermaid\nflowchart LR\n  A --> B\n```',
    filename: 'informe final.md',
    variant: 'print',
    renderDiagram: async () => {
      diagrams += 1
      return { svg: '<svg data-export="diagram"></svg>' }
    },
  })

  assert.equal(diagrams, 1)
  assert.match(html, /<title>informe final<\/title>/)
  assert.match(html, /<h1>Informe<\/h1>/)
  assert.match(html, /<svg data-export="diagram"><\/svg>/)
})

test('renderStandaloneExport fuerza carga eager de imágenes solo en impresión', async () => {
  const markdown = '![Portada](https://example.com/portada.jpg)'
  const screen = await renderStandaloneExport({ markdown, variant: 'screen' })
  const printable = await renderStandaloneExport({ markdown, variant: 'print' })

  assert.match(screen, /loading="lazy"/)
  assert.match(printable, /loading="eager"/)
})

test('renderStandaloneExport propaga Mermaid parcial al documento imprimible', async () => {
  const warnings = []
  const html = await renderStandaloneExport({
    markdown: '```mermaid\ndiagrama inválido\n```',
    filename: 'informe.md',
    variant: 'print',
    renderDiagram: async () => { throw new Error('Mermaid inválido') },
    onWarning: (warning) => warnings.push(warning),
  })

  assert.equal(warnings.length, 1)
  assert.match(html, /data-export-warnings="1"/)
  assert.match(html, /<pre><code class="language-mermaid">diagrama inválido/)
  assert.match(html, /Un diagrama no se ha podido dibujar/)
})

test('rechaza variantes de documento desconocidas', () => {
  assert.throws(
    () => createStandaloneExportDocument({ variant: 'archivo' }),
    /Variante de exportación no válida/,
  )
})
