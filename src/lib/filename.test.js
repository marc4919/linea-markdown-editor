import test from 'node:test'
import assert from 'node:assert/strict'
import { markdownFilename, stripMarkdownExtension } from './filename.js'

test('muestra y normaliza el nombre base de un documento Markdown', () => {
  assert.equal(stripMarkdownExtension('  notas.md  '), 'notas')
  assert.equal(stripMarkdownExtension('notas.md.md'), 'notas')
  assert.equal(markdownFilename('  Mi nota  '), 'Mi nota.md')
  assert.equal(markdownFilename('notas.md.md'), 'notas.md')
})

test('usa documento.md cuando el nombre queda vacío', () => {
  assert.equal(markdownFilename(''), 'documento.md')
  assert.equal(markdownFilename(' .md '), 'documento.md')
})
