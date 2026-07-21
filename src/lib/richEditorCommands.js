import { getMarkRange } from '@tiptap/core'

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
