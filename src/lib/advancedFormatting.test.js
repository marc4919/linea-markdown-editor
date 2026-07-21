import test from 'node:test'
import assert from 'node:assert/strict'
import {
  insertCodeBlock,
  insertFootnote,
  insertHorizontalRule,
  insertImage,
  insertMermaid,
  insertTable,
  insertTask,
  toggleStrikethrough,
} from './advancedFormatting.js'

test('inserta una tabla y selecciona el primer encabezado', () => {
  const edit = insertTable('Antes', 5, 5)
  assert.match(edit.text, /Antes\n\n\| Columna 1 \| Columna 2 \|/)
  assert.equal(edit.text.slice(edit.selectionStart, edit.selectionEnd), 'Columna 1')
})

test('convierte líneas seleccionadas en tareas', () => {
  const edit = insertTask('Uno\nDos', 0, 7)
  assert.equal(edit.text, '- [ ] Uno\n- [ ] Dos')
})

test('envuelve una selección en un bloque de código', () => {
  const edit = insertCodeBlock('const x = 1', 0, 11, 'js')
  assert.equal(edit.text, '```js\nconst x = 1\n```')
  assert.equal(edit.text.slice(edit.selectionStart, edit.selectionEnd), 'const x = 1')
})

test('crea notas al pie con un identificador nuevo', () => {
  const edit = insertFootnote('Texto[^1]', 5, 5)
  assert.equal(edit.text, 'Texto[^2][^1]\n\n[^2]: Nota al pie')
  assert.equal(edit.text.slice(edit.selectionStart, edit.selectionEnd), 'Nota al pie')
})

test('añade la referencia tras una selección sin borrar el texto elegido', () => {
  const text = 'Una frase importante.'
  const result = insertFootnote(text, 4, 9)

  assert.match(result.text, /^Una frase\[\^1\] importante\./)
  assert.match(result.text, /\[\^1\]: Nota al pie$/)
})

test('inserta separadores, Mermaid e imágenes seguras como Markdown', () => {
  assert.match(insertHorizontalRule('A', 1, 1).text, /A\n\n---/)
  assert.match(insertMermaid('', 0, 0).text, /```mermaid/)
  assert.equal(insertImage('', 0, 0, { alt: 'Mapa', url: 'https://example.com/a.png' }).text, '![Mapa](https://example.com/a.png)')
})

test('activa y desactiva tachado conservando la selección', () => {
  const added = toggleStrikethrough('texto', 0, 5)
  assert.equal(added.text, '~~texto~~')
  const removed = toggleStrikethrough(added.text, added.selectionStart, added.selectionEnd)
  assert.equal(removed.text, 'texto')
})
