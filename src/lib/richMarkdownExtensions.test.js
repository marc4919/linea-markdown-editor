import test from 'node:test'
import assert from 'node:assert/strict'
import { Editor } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { richCoreExtensions } from './richCoreExtensions.js'
import { richFootnoteExtensions } from './richMarkdownExtensions.js'

function editorFor(markdown) {
  return new Editor({
    extensions: [
      StarterKit.configure({ horizontalRule: false }),
      Markdown,
      ...richCoreExtensions(),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      ...richFootnoteExtensions(),
    ],
    content: markdown,
    contentType: 'markdown',
  })
}

test('el documento enriquecido conserva el dialecto avanzado de Línea', () => {
  const source = [
    '# Documento',
    '',
    'Texto **fuerte**, ++subrayado++ y referencia[^1].',
    '',
    '- [ ] Tarea pendiente',
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
    '[^1]: Nota conservada',
  ].join('\n')
  const editor = editorFor(source)
  const markdown = editor.getMarkdown()

  assert.match(markdown, /\*\*fuerte\*\*/)
  assert.match(markdown, /\+\+subrayado\+\+/)
  assert.match(markdown, /- \[ \] Tarea pendiente/)
  assert.match(markdown, /\| Nombre \| Estado \|/)
  assert.match(markdown, /```mermaid\nflowchart LR/)
  assert.match(markdown, /\[\^1\]: Nota conservada/)
  editor.destroy()
})

test('conserva pipes escapados y saltos dentro de celdas sin controles invisibles', () => {
  const editor = editorFor('| A | B |\n| --- | --- |\n| x\\|z | y |')
  let cellPosition = null
  editor.state.doc.descendants((node, position) => {
    if (cellPosition === null && node.isText && node.text === 'x|z') cellPosition = position + 2
  })
  editor.commands.setTextSelection(cellPosition)

  assert.equal(editor.commands.splitBlock(), false)
  assert.equal(editor.commands.toggleHeading({ level: 2 }), false)
  assert.equal(editor.commands.toggleBulletList(), false)
  assert.equal(editor.commands.setHorizontalRule(), false)

  const markdown = editor.getMarkdown()
  assert.match(markdown, /x\\\|z/)
  assert.equal(markdown.includes('\u001f'), false)
  editor.destroy()
})
