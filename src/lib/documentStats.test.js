import test from 'node:test'
import assert from 'node:assert/strict'
import { getDocumentStats } from './documentStats.js'

test('cuenta texto visible y no sintaxis Markdown', () => {
  assert.deepEqual(getDocumentStats('# Hola **mundo**'), { words: 2, characters: 10 })
  assert.deepEqual(getDocumentStats('[Línea](https://example.com)'), { words: 1, characters: 5 })
})

test('cuenta espacios y grafemas Unicode, pero no saltos ni espaciadores', () => {
  assert.deepEqual(getDocumentStats('Hola 👋🏽\n\nMundo'), { words: 2, characters: 11 })
  assert.deepEqual(getDocumentStats('Hola\n\n&nbsp;\n\nMundo'), { words: 2, characters: 9 })
})

test('incluye texto visible de código y notas, pero no Mermaid', () => {
  const source = 'Texto[^1]\n\n```js\nconst x = 1\n```\n\n```mermaid\nflowchart LR\nA-->B\n```\n\n[^1]: Nota final'
  const stats = getDocumentStats(source)
  assert.equal(stats.words, 6)
  assert.equal(stats.characters > 0, true)
})
