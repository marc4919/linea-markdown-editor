import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeMarkdownDestination } from './linkDestination.js'

test('normaliza dominios pegados sin esquema', () => {
  assert.equal(normalizeMarkdownDestination('example.com/docs'), 'https://example.com/docs')
})

test('conserva destinos Markdown internos y de contacto', () => {
  assert.equal(normalizeMarkdownDestination('#detalle'), '#detalle')
  assert.equal(normalizeMarkdownDestination('/guia/inicio'), '/guia/inicio')
  assert.equal(normalizeMarkdownDestination('../documento.md'), '../documento.md')
  assert.equal(normalizeMarkdownDestination('mailto:hola@example.com'), 'mailto:hola@example.com')
  assert.equal(normalizeMarkdownDestination('tel:+34123456789'), 'tel:+34123456789')
})

test('limita imágenes a HTTP y rechaza protocolos peligrosos', () => {
  assert.equal(normalizeMarkdownDestination('#detalle', { image: true }), null)
  assert.equal(normalizeMarkdownDestination('mailto:hola@example.com', { image: true }), null)
  assert.equal(normalizeMarkdownDestination('javascript:alert(1)'), null)
  assert.equal(normalizeMarkdownDestination('data:text/html,hello'), null)
})
