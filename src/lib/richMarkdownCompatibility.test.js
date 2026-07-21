import test from 'node:test'
import assert from 'node:assert/strict'
import { getRichMarkdownLimitations, richMarkdownNotice } from './richMarkdownCompatibility.js'

test('protege construcciones que el editor enriquecido no representa', () => {
  const source = [
    '---',
    'title: Documento',
    '---',
    '',
    '<!-- comentario -->',
    '',
    '[destino]: https://example.com',
    '',
    'Texto [enlazado][destino]',
  ].join('\n')

  assert.deepEqual(getRichMarkdownLimitations(source), [
    'metadatos de cabecera',
    'HTML incrustado',
    'enlaces por referencia',
  ])
  assert.match(richMarkdownNotice(source), /Para no perder ese Markdown/)
})

test('permite el dialecto avanzado que Línea sí conserva', () => {
  const source = [
    '# Documento',
    '',
    'Texto **fuerte**, ++subrayado++ y [enlace](https://example.com).',
    '',
    '- [ ] Tarea',
    '',
    '| Nombre | Estado |',
    '| --- | --- |',
    '| Línea | Lista |',
    '',
    '```mermaid',
    'flowchart LR',
    '  Idea --> Publicación',
    '```',
    '',
    '[^1]: Nota al pie',
  ].join('\n')

  assert.deepEqual(getRichMarkdownLimitations(source), [])
  assert.equal(richMarkdownNotice(source), '')
})

test('no confunde separadores ni autolinks con cabeceras o HTML', () => {
  const source = '---\n\n<https://example.com>\n\nContacto <hola@example.com>'
  assert.deepEqual(getRichMarkdownLimitations(source), [])
})

test('protege referencias cuyo destino continúa en una línea indentada', () => {
  const source = '[destino]:\n  https://example.com\n\nTexto [enlazado][destino]'
  assert.deepEqual(getRichMarkdownLimitations(source), ['enlaces por referencia'])
  assert.deepEqual(getRichMarkdownLimitations('[destino]:\n    https://example.com\n\n[enlace][destino]'), ['enlaces por referencia'])
  assert.deepEqual(getRichMarkdownLimitations('[destino]:\nhttps://example.com\n\n[enlace][destino]'), ['enlaces por referencia'])
})

test('protege declaraciones HTML, instrucciones de procesamiento y CDATA', () => {
  const samples = [
    '<!DOCTYPE html>',
    '<?xml version="1.0"?>',
    '<![CDATA[contenido]]>',
  ]

  for (const source of samples) {
    assert.deepEqual(getRichMarkdownLimitations(source), ['HTML incrustado'])
  }
})

test('protege tareas numeradas que el esquema enriquecido no representa', () => {
  const source = '1. [ ] Primer paso\n2. [x] Segundo paso'
  assert.deepEqual(getRichMarkdownLimitations(source), ['listas de tareas numeradas'])
})

test('protege entidades Markdown para que no cambie su significado al serializar', () => {
  const source = 'AT&amp;T, &copy; y &#169;'
  assert.deepEqual(getRichMarkdownLimitations(source), ['entidades Markdown'])
  assert.deepEqual(getRichMarkdownLimitations('Texto \\&copy; literal'), [])
})

test('protege notas inline, notas complejas y código con delimitadores múltiples', () => {
  assert.deepEqual(getRichMarkdownLimitations('Texto ^[nota breve].'), ['notas al pie inline'])
  assert.deepEqual(getRichMarkdownLimitations('[^1]: Primer párrafo\n\n    Segundo párrafo'), ['notas al pie complejas'])
  assert.deepEqual(getRichMarkdownLimitations('Texto ``b ` c``.'), ['código inline con backticks'])
})
