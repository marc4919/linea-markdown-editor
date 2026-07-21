import test from 'node:test'
import assert from 'node:assert/strict'
import { Editor } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { richFootnoteExtensions } from './richMarkdownExtensions.js'
import {
  getRichLinkState,
  insertRichFootnote,
  insertRichImage,
  insertRichHorizontalRule,
  insertRichMarkdownPreservingSelection,
  insertRichNodePreservingSelection,
  isRichSelectionInsideTable,
  normalizeRichInlineSelection,
  setRichLink,
} from './richEditorCommands.js'

test('normaliza espacios de una selección enriquecida antes de aplicar formato', () => {
  const editor = new Editor({ extensions: [StarterKit, Markdown], content: 'Una palabra ', contentType: 'markdown' })
  editor.commands.setTextSelection({ from: 5, to: 13 })
  assert.deepEqual(normalizeRichInlineSelection(editor), { from: 5, to: 12 })

  editor.commands.setTextSelection({ from: 12, to: 13 })
  assert.deepEqual(normalizeRichInlineSelection(editor), { from: 5, to: 12 })
  editor.destroy()
})

test('los bloques enriquecidos no sustituyen el texto seleccionado', () => {
  const editor = new Editor({
    extensions: [StarterKit, Markdown, TableKit],
    content: 'Antes después',
    contentType: 'markdown',
  })
  editor.commands.setTextSelection({ from: 1, to: 6 })

  insertRichMarkdownPreservingSelection(editor, [
    '| A | B |',
    '| --- | --- |',
    '| 1 | 2 |',
  ].join('\n'))

  const markdown = editor.getMarkdown()
  assert.match(markdown, /^Antes después/)
  assert.match(markdown, /\| A\s+\| B\s+\|/)
  editor.destroy()
})

test('eleva una tabla nueva fuera de la tabla en la que está el cursor', () => {
  const editor = new Editor({
    extensions: [StarterKit, Markdown, TableKit],
    content: [
      '| A | B |',
      '| --- | --- |',
      '| X | Y |',
    ].join('\n'),
    contentType: 'markdown',
  })
  let cellTextPosition = null
  editor.state.doc.descendants((node, position) => {
    if (cellTextPosition === null && node.isText && node.text?.includes('X')) cellTextPosition = position + 1
  })
  editor.commands.setTextSelection(cellTextPosition)
  assert.equal(isRichSelectionInsideTable(editor), true)

  insertRichMarkdownPreservingSelection(editor, [
    '| Nueva | Tabla |',
    '| --- | --- |',
    '| 1 | 2 |',
  ].join('\n'))

  const markdown = editor.getMarkdown()
  assert.match(markdown, /\| A\s+\| B\s+\|[\s\S]*\| X\s+\| Y\s+\|/)
  assert.match(markdown, /\| Nueva\s+\| Tabla\s+\|/)
  assert.equal(markdown.includes('\u001f'), false)
  editor.destroy()
})

test('eleva también los bloques de diagrama fuera de una celda', () => {
  const editor = new Editor({
    extensions: [StarterKit, Markdown, TableKit],
    content: '| A | B |\n| --- | --- |\n| X | Y |',
    contentType: 'markdown',
  })
  let cellTextPosition = null
  editor.state.doc.descendants((node, position) => {
    if (cellTextPosition === null && node.isText && node.text === 'X') cellTextPosition = position + 1
  })
  editor.commands.setTextSelection(cellTextPosition)
  const codeBlock = editor.schema.nodes.codeBlock.create(null, editor.schema.text('flowchart TD\n  A --> B'))

  insertRichNodePreservingSelection(editor, codeBlock)

  const markdown = editor.getMarkdown()
  assert.match(markdown, /\| X\s+\| Y\s+\|[\s\S]*```\nflowchart TD/)
  assert.equal(markdown.includes('\u001f'), false)
  editor.destroy()
})

test('edita el texto del enlace activo completo con el cursor colapsado', () => {
  const editor = new Editor({
    extensions: [StarterKit, Markdown],
    content: 'Antes [enlace](https://example.com) después',
    contentType: 'markdown',
  })
  let linkPosition = null
  editor.state.doc.descendants((node, position) => {
    if (linkPosition === null && node.isText && node.text === 'enlace') linkPosition = position + 3
  })
  editor.commands.setTextSelection(linkPosition)

  assert.deepEqual(getRichLinkState(editor), {
    label: 'enlace',
    url: 'https://example.com',
    active: true,
  })
  setRichLink(editor, { label: 'destino', url: 'https://openai.com' })

  assert.equal(editor.getMarkdown(), 'Antes [destino](https://openai.com) después')
  editor.destroy()
})

test('eleva imágenes fuera de una tabla sin partir sus filas', () => {
  const editor = new Editor({
    extensions: [StarterKit, Markdown, TableKit, Image],
    content: '| A | B |\n| --- | --- |\n| X | Y |',
    contentType: 'markdown',
  })
  let cellPosition = null
  editor.state.doc.descendants((node, position) => {
    if (cellPosition === null && node.isText && node.text === 'X') cellPosition = position + 1
  })
  editor.commands.setTextSelection(cellPosition)
  insertRichImage(editor, { src: 'https://example.com/imagen.png', alt: 'Imagen' })

  const markdown = editor.getMarkdown()
  assert.equal((markdown.match(/\| A\s+\| B\s+\|/g) ?? []).length, 1)
  assert.match(markdown, /\| X\s+\| Y\s+\|[\s\S]*!\[Imagen\]\(https:\/\/example\.com\/imagen\.png\)/)
  assert.equal(markdown.includes('\u001f'), false)
  editor.destroy()
})

test('inserta un separador sin borrar ni partir el texto seleccionado', () => {
  const editor = new Editor({
    extensions: [StarterKit, Markdown],
    content: 'Antes después',
    contentType: 'markdown',
  })
  editor.commands.setTextSelection({ from: 1, to: 6 })
  insertRichHorizontalRule(editor)

  const markdown = editor.getMarkdown()
  assert.match(markdown, /^Antes después\n\n---$/)
  editor.destroy()
})

test('inserta una referencia inline tras la selección y la definición al final', () => {
  const editor = new Editor({
    extensions: [StarterKit, Markdown, ...richFootnoteExtensions()],
    content: 'Una frase importante.',
    contentType: 'markdown',
  })
  editor.commands.setTextSelection({ from: 5, to: 10 })
  const transactions = []
  editor.on('transaction', ({ transaction }) => transactions.push(transaction))

  assert.equal(insertRichFootnote(editor, { id: 1, text: 'Contexto adicional' }), true)
  assert.equal(editor.getMarkdown(), 'Una frase[^1] importante.\n\n[^1]: Contexto adicional')
  assert.equal(editor.state.selection.empty, true)
  assert.equal(editor.state.selection.$from.nodeBefore?.type.name, 'footnoteReference')
  assert.equal(editor.state.doc.lastChild?.type.name, 'footnoteDefinition')
  assert.equal(editor.state.doc.lastChild?.attrs.text, 'Contexto adicional')
  assert.equal(transactions.length, 1)
  assert.equal(transactions[0].steps.length, 2)
  assert.equal(transactions[0].docChanged, true)
  editor.destroy()
})

test('coordina una nota nueva con las existentes sin crear un párrafo de referencia', () => {
  const editor = new Editor({
    extensions: [StarterKit, Markdown, ...richFootnoteExtensions()],
    content: 'Texto[^1]\n\n[^1]: Primera nota',
    contentType: 'markdown',
  })
  editor.commands.setTextSelection(6)

  insertRichFootnote(editor, { id: 2, text: 'Segunda nota' })

  assert.equal(editor.getMarkdown(), 'Texto[^2][^1]\n\n[^1]: Primera nota\n\n[^2]: Segunda nota')
  assert.equal(editor.state.doc.child(0).type.name, 'paragraph')
  assert.equal(editor.state.doc.child(0).child(1).type.name, 'footnoteReference')
  assert.equal(editor.state.doc.child(0).child(2).type.name, 'footnoteReference')
  assert.equal(editor.state.doc.childCount, 3)
  editor.destroy()
})

test('rechaza una nota enriquecida vacía sin mutar documento ni selección', () => {
  const editor = new Editor({
    extensions: [StarterKit, Markdown, ...richFootnoteExtensions()],
    content: 'Texto intacto',
    contentType: 'markdown',
  })
  editor.commands.setTextSelection({ from: 2, to: 7 })
  const before = editor.state.selection.toJSON()

  assert.equal(insertRichFootnote(editor, { id: 1, text: '   ' }), false)
  assert.equal(editor.getMarkdown(), 'Texto intacto')
  assert.deepEqual(editor.state.selection.toJSON(), before)
  editor.destroy()
})
