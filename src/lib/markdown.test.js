import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown } from './markdown.js'

test('renderiza párrafos continuos como un único bloque', () => {
  assert.equal(renderMarkdown('Primera línea\nsegunda línea'), '<p>Primera línea segunda línea</p>')
})

test('renderiza formato inline de Markdown sin habilitar HTML crudo', () => {
  const html = renderMarkdown('**fuerte**, _énfasis_, ~~tachado~~, ++subrayado++ y `código`')

  assert.equal(
    html,
    '<p><strong>fuerte</strong>, <em>énfasis</em>, <s>tachado</s>, <u>subrayado</u> y <code>código</code></p>',
  )
})

test('renderiza listas ordenadas y listas anidadas', () => {
  const html = renderMarkdown('1. Uno\n2. Dos\n   - Hijo\n     1. Nieto\n3. Tres')

  assert.match(html, /^<ol>/)
  assert.match(html, /<li>Dos\n<ul>/)
  assert.match(html, /<li>Hijo\n<ol>/)
  assert.match(html, /<li>Nieto<\/li>/)
  assert.match(html, /<li>Tres<\/li>/)
})

test('respeta el número inicial de una lista ordenada', () => {
  assert.match(renderMarkdown('3. Tres\n4. Cuatro'), /^<ol start="3">/)
})

test('renderiza tareas marcadas y pendientes como controles deshabilitados', () => {
  const html = renderMarkdown('- [x] Hecho\n- [ ] Pendiente')

  assert.match(html, /<ul class="contains-task-list">/)
  assert.match(html, /class="task-list-item task-item"/)
  assert.match(html, /class="task-list-item-checkbox" checked="" disabled="" type="checkbox"/)
  assert.match(html, /class="task-list-item-checkbox" disabled="" type="checkbox"/)
})

test('renderiza tablas GFM, incluida la alineación de columnas', () => {
  const html = renderMarkdown('| Izquierda | Centro | Derecha |\n| :-- | :-: | --: |\n| A | B | C |')

  assert.match(html, /^<table>/)
  assert.match(html, /<th style="text-align:left">Izquierda<\/th>/)
  assert.match(html, /<th style="text-align:center">Centro<\/th>/)
  assert.match(html, /<td style="text-align:right">C<\/td>/)
  assert.match(html, /<\/table>$/)
})

test('renderiza referencias y definiciones de notas al pie', () => {
  const html = renderMarkdown('Texto con nota[^detalle].\n\n[^detalle]: Explicación **ampliada**.')

  assert.match(html, /<sup class="footnote-ref"><a href="#fn1" id="fnref1">\[1\]<\/a><\/sup>/)
  assert.match(html, /<section class="footnotes">/)
  assert.match(html, /<li id="fn1" class="footnote-item"><p>Explicación <strong>ampliada<\/strong>\./)
  assert.match(html, /href="#fnref1" class="footnote-backref"/)
})

test('renderiza bloques de código con lenguaje y escapa su contenido', () => {
  const html = renderMarkdown('```js\nconst x = "<tag>"\n```')

  assert.match(html, /^<pre><code class="language-js">/)
  assert.match(html, /&lt;tag&gt;/)
  assert.doesNotMatch(html, /<tag>/)
})

test('escapa HTML crudo tanto en bloques como en contenido inline', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\nTexto <img src=x onerror=alert(1)>')

  assert.doesNotMatch(html, /<script>|<img/)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
})

test('añade protección a enlaces web externos y conserva enlaces internos', () => {
  const external = renderMarkdown('[web](https://example.com)')
  const internal = renderMarkdown('[sección](#detalle)')

  assert.match(external, /href="https:\/\/example\.com"/)
  assert.match(external, /target="_blank"/)
  assert.match(external, /rel="noopener noreferrer"/)
  assert.equal(internal, '<p><a href="#detalle">sección</a></p>')
})

test('no enlaza protocolos peligrosos ni permite imágenes data', () => {
  const markdown = [
    '[script](javascript:alert(1))',
    '[script mixto](JaVaScRiPt:alert(1))',
    '[archivo](file:///etc/passwd)',
    '[datos](data:text/html,boom)',
    '![datos](data:image/png;base64,AAAA)',
  ].join('\n\n')
  const html = renderMarkdown(markdown)

  assert.doesNotMatch(html, /href=|src=/)
  assert.doesNotMatch(html, /<a|<img/)
})

test('renderiza imágenes web seguras con carga diferida y alt escapado', () => {
  const html = renderMarkdown('![Una <imagen>](https://example.com/image.png "Título")')

  assert.match(html, /src="https:\/\/example\.com\/image\.png"/)
  assert.match(html, /alt="Una &lt;imagen&gt;"/)
  assert.match(html, /title="Título"/)
  assert.match(html, /loading="lazy"/)
})

test('sourceMap añade líneas uno-basadas a los bloques principales', () => {
  const markdown = '# Título\n\nPárrafo\n\n> Cita\n\n- Elemento\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n---'
  const html = renderMarkdown(markdown, { sourceMap: true })

  assert.match(html, /<h1 data-source-line="1">Título<\/h1>/)
  assert.match(html, /<p data-source-line="3">Párrafo<\/p>/)
  assert.match(html, /<blockquote data-source-line="5">/)
  assert.match(html, /<ul data-source-line="7">/)
  assert.match(html, /<li data-source-line="7">Elemento<\/li>/)
  assert.match(html, /<table data-source-line="9">/)
  assert.match(html, /<hr data-source-line="13">/)
})

test('sourceMap coloca la línea en pre para fences y bloques indentados', () => {
  const fenced = renderMarkdown('Texto\n\n```ts\nconst ok = true\n```', { sourceMap: true })
  const indented = renderMarkdown('    const ok = true', { sourceMap: true })

  assert.match(fenced, /<pre data-source-line="3"><code class="language-ts">/)
  assert.doesNotMatch(fenced, /<code[^>]+data-source-line/)
  assert.match(indented, /<pre data-source-line="1"><code>/)
})

test('sourceMap es opt-in y no contamina renderizados posteriores', () => {
  const markdown = '# Título\n\nTexto'

  assert.match(renderMarkdown(markdown, { sourceMap: true }), /data-source-line=/)
  assert.doesNotMatch(renderMarkdown(markdown), /data-source-line=/)
  assert.doesNotMatch(renderMarkdown(markdown, { sourceMap: false }), /data-source-line=/)
})

test('acepta contenido vacío o nulo sin producir marcado', () => {
  assert.equal(renderMarkdown(''), '')
  assert.equal(renderMarkdown(null), '')
})
