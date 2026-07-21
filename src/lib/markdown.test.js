import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown } from './markdown.js'

test('renderiza párrafos continuos como un único bloque', () => {
  assert.equal(renderMarkdown('Primera línea\nsegunda línea'), '<p>Primera línea segunda línea</p>')
})

test('renderiza listas numeradas y tareas', () => {
  const html = renderMarkdown('1. Uno\n2. Dos\n\n- [x] Hecho\n- [ ] Pendiente')
  assert.match(html, /<ol><li>Uno<\/li><li>Dos<\/li><\/ol>/)
  assert.match(html, /class="task-item"/)
  assert.match(html, /checked/)
})

test('conserva de forma segura HTML introducido por el usuario', () => {
  const html = renderMarkdown('<script>alert(1)</script>')
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
})

test('sólo convierte enlaces web seguros', () => {
  assert.match(renderMarkdown('[web](https://example.com)'), /rel="noopener noreferrer"/)
  assert.doesNotMatch(renderMarkdown('[mal](javascript:alert(1))'), /href=/)
})

test('renderiza bloques de código y escapa su contenido', () => {
  const html = renderMarkdown('```js\nconst x = "<tag>"\n```')
  assert.match(html, /class="language-js"/)
  assert.match(html, /&lt;tag&gt;/)
})
