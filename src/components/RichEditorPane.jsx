import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { createRichCodeBlock } from './RichCodeBlockNodeView.jsx'
import {
  getRichLinkState,
  insertRichFootnote,
  insertRichHorizontalRule,
  insertRichImage,
  insertRichMarkdownPreservingSelection,
  insertRichNodePreservingSelection,
  isRichSelectionInsideTable,
  setRichLink,
} from '../lib/richEditorCommands.js'
import { richCoreExtensions } from '../lib/richCoreExtensions.js'
import { richFootnoteExtensions } from '../lib/richMarkdownExtensions.js'

function currentFormatState(editor) {
  if (!editor) return {}
  const insideTable = isRichSelectionInsideTable(editor)
  const headingLevel = [1, 2, 3, 4, 5, 6]
    .find((level) => editor.isActive('heading', { level })) || 0

  return {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    link: editor.isActive('link'),
    list: editor.isActive('bulletList'),
    quote: editor.isActive('blockquote'),
    code: editor.isActive('code'),
    strike: editor.isActive('strike'),
    underline: editor.isActive('underline'),
    task: editor.isActive('taskList'),
    headingLevel,
    blockFormattingDisabled: insideTable,
  }
}

const RichEditorPane = forwardRef(function RichEditorPane({
  markdown,
  onChange,
  onFormatStateChange,
  onEditMermaid,
}, forwardedRef) {
  const handlersRef = useRef({ onChange, onFormatStateChange, onEditMermaid })
  const markdownRef = useRef(markdown ?? '')
  const applyingExternalRef = useRef(false)

  handlersRef.current = { onChange, onFormatStateChange, onEditMermaid }
  markdownRef.current = markdown ?? ''

  const extensions = useMemo(() => [
    StarterKit.configure({
      codeBlock: false,
      horizontalRule: false,
      link: {
        autolink: true,
        openOnClick: false,
        linkOnPaste: true,
      },
    }),
    createRichCodeBlock((payload) => handlersRef.current.onEditMermaid?.(payload)),
    Markdown,
    ...richCoreExtensions(),
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({ allowBase64: false }),
    ...richFootnoteExtensions(),
  ], [])

  const reportFormats = (editor) => {
    handlersRef.current.onFormatStateChange?.(currentFormatState(editor))
  }

  const editor = useEditor({
    extensions,
    content: markdownRef.current,
    contentType: 'markdown',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'rich-editor-content',
        'aria-label': 'Contenido enriquecido',
        autocapitalize: 'sentences',
        spellcheck: 'true',
      },
    },
    onCreate({ editor: createdEditor }) {
      reportFormats(createdEditor)
    },
    onSelectionUpdate({ editor: updatedEditor }) {
      reportFormats(updatedEditor)
    },
    onTransaction({ editor: updatedEditor }) {
      reportFormats(updatedEditor)
    },
    onUpdate({ editor: updatedEditor }) {
      if (applyingExternalRef.current) return
      const nextMarkdown = updatedEditor.getMarkdown()
      if (nextMarkdown !== markdownRef.current) handlersRef.current.onChange?.(nextMarkdown)
    },
  })

  useEffect(() => {
    if (!editor) return
    const nextMarkdown = markdown ?? ''
    if (editor.getMarkdown() === nextMarkdown) return
    applyingExternalRef.current = true
    editor.commands.setContent(nextMarkdown, { contentType: 'markdown', emitUpdate: false })
    applyingExternalRef.current = false
    reportFormats(editor)
  }, [editor, markdown])

  useImperativeHandle(forwardedRef, () => ({
    focus() {
      editor?.commands.focus()
    },
    hasFocus() {
      return Boolean(editor?.isFocused)
    },
    undo() {
      return editor?.commands.undo() ?? false
    },
    redo() {
      return editor?.commands.redo() ?? false
    },
    getFormatState() {
      return currentFormatState(editor)
    },
    getLinkState() {
      return getRichLinkState(editor)
    },
    setLink({ label, url }) {
      return setRichLink(editor, { label, url })
    },
    unsetLink() {
      if (!editor) return false
      return editor.chain().focus().extendMarkRange('link').unsetLink().run()
    },
    format(id) {
      if (!editor) return false
      const insideTable = isRichSelectionInsideTable(editor)
      if (insideTable && ['list', 'task', 'quote', 'codeblock', 'rule'].includes(id)) return false
      if (id === 'rule') return insertRichHorizontalRule(editor)
      const chain = editor.chain().focus()
      const commands = {
        bold: () => chain.toggleBold().run(),
        italic: () => chain.toggleItalic().run(),
        underline: () => chain.toggleUnderline().run(),
        strike: () => chain.toggleStrike().run(),
        list: () => chain.toggleBulletList().run(),
        task: () => chain.toggleTaskList().run(),
        quote: () => chain.toggleBlockquote().run(),
        code: () => chain.toggleCode().run(),
        codeblock: () => chain.toggleCodeBlock().run(),
      }
      return commands[id]?.() ?? false
    },
    setHeading(level) {
      if (!editor) return false
      if (isRichSelectionInsideTable(editor)) return false
      const chain = editor.chain().focus()
      return level ? chain.toggleHeading({ level }).run() : chain.setParagraph().run()
    },
    insertTable({ columns = 3, bodyRows = 2 } = {}) {
      return editor?.chain().focus().insertTable({
        rows: Math.max(2, Number(bodyRows) + 1),
        cols: Math.max(1, Number(columns)),
        withHeaderRow: true,
      }).run() ?? false
    },
    insertImage({ alt, url }) {
      return insertRichImage(editor, { src: url, alt })
    },
    insertMarkdown(source) {
      return insertRichMarkdownPreservingSelection(editor, source)
    },
    insertFootnote({ id, text }) {
      return insertRichFootnote(editor, { id, text })
    },
    setMermaid(source, position) {
      if (!editor) return false
      const codeBlock = editor.schema.nodes.codeBlock
      const content = source ? editor.schema.text(String(source)) : undefined
      const node = codeBlock.create({ language: 'mermaid' }, content)
      if (Number.isInteger(position) && editor.state.doc.nodeAt(position)?.type === codeBlock) {
        editor.view.dispatch(editor.state.tr.replaceWith(
          position,
          position + editor.state.doc.nodeAt(position).nodeSize,
          node,
        ))
        return true
      }
      return insertRichNodePreservingSelection(editor, node)
    },
  }), [editor])

  return (
    <section className="pane editor-pane rich-editor-pane" aria-labelledby="rich-editor-heading">
      <div className="pane-heading" id="rich-editor-heading">
        <span>Edición enriquecida</span>
        <small>Escribe como en un documento; Línea guarda Markdown</small>
      </div>
      <div className="rich-editor-scroll">
        <EditorContent editor={editor} />
      </div>
    </section>
  )
})

export default RichEditorPane
