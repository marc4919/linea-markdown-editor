import { getMarkRange } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

const INLINE_WHITESPACE = /^\s+$/u

export function normalizeRichInlineSelection(editor) {
  if (!editor) return null
  const { selection, doc } = editor.state
  const { from, to, $from, $to } = selection
  if (!$from.parent.inlineContent || !$to.parent.inlineContent || $from.parent !== $to.parent) return { from, to }

  const selected = doc.textBetween(from, to, '', '')
  if (selected && !INLINE_WHITESPACE.test(selected)) {
    const leading = selected.match(/^\s+/u)?.[0].length ?? 0
    const trailing = selected.match(/\s+$/u)?.[0].length ?? 0
    return { from: from + leading, to: Math.max(from + leading, to - trailing) }
  }

  if (!selected && from === to) return { from, to }
  const before = $from.parent.textContent.slice(0, $from.parentOffset)
  const previousWord = before.match(/\S+\s*$/u)
  if (!previousWord) return { from, to }
  const word = previousWord[0].trimEnd()
  const parentStart = $from.start()
  const wordFrom = parentStart + previousWord.index
  return { from: wordFrom, to: wordFrom + word.length }
}

function topLevelInsertionPoint(editor) {
  const { $to } = editor.state.selection
  return $to.depth > 0 ? $to.after(1) : $to.pos
}

function richLinkRange(editor) {
  if (!editor) return null
  const { selection, schema } = editor.state
  if (!selection.empty) return { from: selection.from, to: selection.to }
  const link = schema.marks.link
  return link ? getMarkRange(selection.$from, link) : null
}

export function getRichLinkState(editor) {
  if (!editor) return { label: '', url: '', active: false }
  const active = editor.isActive('link')
  const range = active ? richLinkRange(editor) : null
  const { from, to } = range ?? editor.state.selection
  return {
    label: editor.state.doc.textBetween(from, to, ' '),
    url: editor.getAttributes('link')?.href ?? '',
    active,
  }
}

export function setRichLink(editor, { label, url }) {
  if (!editor) return false
  const cleanLabel = String(label ?? '').trim()
  const href = String(url ?? '').trim()
  const activeRange = editor.isActive('link') ? richLinkRange(editor) : null
  const selection = activeRange ?? editor.state.selection
  const currentLabel = editor.state.doc.textBetween(selection.from, selection.to, ' ')
  const chain = editor.chain().focus()

  if (activeRange) chain.setTextSelection(activeRange)
  if (cleanLabel && cleanLabel !== currentLabel) {
    return chain.insertContent({
      type: 'text',
      text: cleanLabel,
      marks: [{ type: 'link', attrs: { href } }],
    }).run()
  }
  if (selection.from !== selection.to || activeRange) return chain.setLink({ href }).run()
  return chain.insertContent({
    type: 'text',
    text: cleanLabel || href,
    marks: [{ type: 'link', attrs: { href } }],
  }).run()
}

export function isRichSelectionInsideTable(editor) {
  if (!editor) return false
  const positions = [editor.state.selection.$from, editor.state.selection.$to]
  return positions.some(($position) => {
    for (let depth = $position.depth; depth > 0; depth -= 1) {
      if ($position.node(depth).type.name === 'table') return true
    }
    return false
  })
}

export function insertRichMarkdownPreservingSelection(editor, source) {
  if (!editor) return false
  const insertionPosition = topLevelInsertionPoint(editor)
  return editor.chain()
    .focus()
    .insertContentAt(insertionPosition, String(source ?? ''), {
      contentType: 'markdown',
      updateSelection: true,
    })
    .run()
}

export function insertRichNodePreservingSelection(editor, node) {
  if (!editor || !node) return false
  const insertionPosition = topLevelInsertionPoint(editor)
  return editor.chain()
    .focus()
    .insertContentAt(
      insertionPosition,
      typeof node.toJSON === 'function' ? node.toJSON() : node,
      { updateSelection: true },
    )
    .run()
}

export function insertRichImage(editor, attrs) {
  if (!editor) return false
  if (!isRichSelectionInsideTable(editor)) {
    return editor.chain().focus().setImage(attrs).run()
  }
  const image = editor.schema.nodes.image?.create(attrs)
  return image ? insertRichNodePreservingSelection(editor, image) : false
}

export function insertRichHorizontalRule(editor) {
  const rule = editor?.schema.nodes.horizontalRule?.create()
  return rule ? insertRichNodePreservingSelection(editor, rule) : false
}

export function insertRichFootnote(editor, { id, text } = {}) {
  if (!editor) return false
  const identifier = String(id ?? '').trim()
  const content = String(text ?? '').trim()
  const referenceType = editor.schema.nodes.footnoteReference
  const definitionType = editor.schema.nodes.footnoteDefinition
  const { selection } = editor.state

  if (!identifier || !content || !referenceType || !definitionType || !selection.$to.parent.inlineContent) return false

  const reference = referenceType.create({ id: identifier })
  const definition = definitionType.create({ id: identifier, text: content })
  const referencePosition = selection.to
  const cursorPosition = referencePosition + reference.nodeSize
  const transaction = editor.state.tr.insert(referencePosition, reference)
  transaction.insert(transaction.doc.content.size, definition)

  transaction.setSelection(TextSelection.near(transaction.doc.resolve(cursorPosition), 1))
  editor.view.dispatch(transaction.scrollIntoView())
  return true
}
