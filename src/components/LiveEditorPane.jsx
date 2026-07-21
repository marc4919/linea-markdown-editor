import { useId, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { Annotation, EditorSelection, EditorState, Transaction } from '@codemirror/state'
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view'
import { liveMarkdownExtensions, updateLiveMarkdownVariant } from '../lib/liveMarkdown.js'

const externalDocumentUpdate = Annotation.define()
const editorSetup = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  keymap.of([...closeBracketsKeymap, ...defaultKeymap]),
]

const EDITOR_HOST_STYLE = {
  flex: '1 1 auto',
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
}

function clampPosition(position, documentLength) {
  const number = Number.isFinite(Number(position)) ? Math.trunc(Number(position)) : 0
  return Math.max(0, Math.min(number, documentLength))
}

function selectionSnapshot(view) {
  const selection = view?.state.selection.main
  if (!selection) return { start: 0, end: 0, direction: 'none' }
  return {
    start: selection.from,
    end: selection.to,
    direction: selection.empty ? 'none' : selection.anchor > selection.head ? 'backward' : 'forward',
  }
}

function createEditorHandle(viewRef, markdownRef) {
  return {
    get value() {
      return viewRef.current?.state.doc.toString() ?? markdownRef.current
    },
    get selectionStart() {
      return selectionSnapshot(viewRef.current).start
    },
    get selectionEnd() {
      return selectionSnapshot(viewRef.current).end
    },
    get selectionDirection() {
      return selectionSnapshot(viewRef.current).direction
    },
    get scrollTop() {
      return viewRef.current?.scrollDOM.scrollTop ?? 0
    },
    set scrollTop(value) {
      const view = viewRef.current
      if (view) view.scrollDOM.scrollTop = Number(value) || 0
    },
    get contentDOM() {
      return viewRef.current?.contentDOM ?? null
    },
    get scrollDOM() {
      return viewRef.current?.scrollDOM ?? null
    },
    focus(options) {
      const view = viewRef.current
      if (!view) return
      if (options) view.contentDOM.focus(options)
      else view.focus()
    },
    blur() {
      viewRef.current?.contentDOM.blur()
    },
    hasFocus() {
      return viewRef.current?.hasFocus ?? false
    },
    setSelectionRange(start, end, direction = 'none') {
      const view = viewRef.current
      if (!view) return
      const length = view.state.doc.length
      const safeStart = clampPosition(start, length)
      const safeEnd = clampPosition(end, length)
      const from = Math.min(safeStart, safeEnd)
      const to = Math.max(safeStart, safeEnd)
      const selection = direction === 'backward'
        ? EditorSelection.single(to, from)
        : EditorSelection.single(from, to)
      view.dispatch({ selection })
    },
    scrollToLine(line) {
      const view = viewRef.current
      if (!view) return
      const requestedLine = Number.isFinite(Number(line)) ? Math.trunc(Number(line)) : 1
      const lineNumber = Math.max(1, Math.min(requestedLine, view.state.doc.lines))
      const position = view.state.doc.line(lineNumber).from
      view.dispatch({ effects: EditorView.scrollIntoView(position, { y: 'start', yMargin: 30 }) })
    },
    requestMeasure() {
      viewRef.current?.requestMeasure()
    },
  }
}

/**
 * A controlled CodeMirror editor with a Bear-like Live mode.
 *
 * `textareaRef` intentionally exposes the textarea-compatible subset used by
 * Línea, plus `hasFocus()` and `scrollToLine()`, while the editor itself keeps
 * CodeMirror's native selection and history model.
 */
export default function LiveEditorPane({
  markdown: markdownValue,
  onChange,
  onCursorChange,
  onSelectionChange,
  onKeyDown,
  onUndo,
  onRedo,
  textareaRef,
  variant = 'live',
}) {
  const headingId = useId()
  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const markdownRef = useRef(markdownValue ?? '')
  const handlersRef = useRef(null)

  markdownRef.current = markdownValue ?? ''
  handlersRef.current = { onChange, onCursorChange, onSelectionChange, onKeyDown, onUndo, onRedo }

  const editorHandle = useMemo(() => createEditorHandle(viewRef, markdownRef), [])
  useImperativeHandle(textareaRef, () => editorHandle, [editorHandle])

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    const reportSelection = () => {
      const handlers = handlersRef.current
      handlers.onCursorChange?.(editorHandle)
      handlers.onSelectionChange?.(selectionSnapshot(viewRef.current))
    }

    const state = EditorState.create({
      doc: markdownRef.current,
      extensions: [
        EditorView.domEventHandlers({
          keydown(event) {
            handlersRef.current.onKeyDown?.(event)
            return event.defaultPrevented
          },
          beforeinput(event) {
            if (event.inputType !== 'historyUndo' && event.inputType !== 'historyRedo') return false
            event.preventDefault()
            if (event.inputType === 'historyUndo') handlersRef.current.onUndo?.()
            else handlersRef.current.onRedo?.()
            return true
          },
        }),
        ...editorSetup,
        markdown({ base: markdownLanguage }),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': 'Contenido Markdown',
          autocapitalize: 'sentences',
          spellcheck: 'true',
        }),
        ...liveMarkdownExtensions(variant),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const isExternal = update.transactions.some((transaction) => (
              transaction.annotation(externalDocumentUpdate) === true
            ))
            if (!isExternal) handlersRef.current.onChange?.(update.state.doc.toString())
          }
          if (update.docChanged || update.selectionSet) reportSelection()
        }),
      ],
    })

    const view = new EditorView({ state, parent: host })
    viewRef.current = view

    return () => {
      if (viewRef.current === view) viewRef.current = null
      view.destroy()
    }
  }, [editorHandle])

  useLayoutEffect(() => {
    const view = viewRef.current
    if (!view) return
    updateLiveMarkdownVariant(view, variant)
  }, [variant])

  useLayoutEffect(() => {
    const view = viewRef.current
    if (!view) return

    const nextDocument = markdownValue ?? ''
    const currentDocument = view.state.doc.toString()
    if (currentDocument === nextDocument) return

    const currentSelection = view.state.selection.main
    const nextLength = nextDocument.length
    const anchor = clampPosition(currentSelection.anchor, nextLength)
    const head = clampPosition(currentSelection.head, nextLength)

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextDocument },
      selection: EditorSelection.single(anchor, head),
      annotations: [
        externalDocumentUpdate.of(true),
        Transaction.addToHistory.of(false),
      ],
    })
  }, [markdownValue])

  return (
    <section
      className="pane editor-pane live-editor-pane"
      aria-labelledby={headingId}
      data-editor-variant={variant === 'source' ? 'source' : 'live'}
    >
      <div className="pane-heading" id={headingId}>
        <span>{variant === 'source' ? 'Fuente Markdown' : 'Edición Live'}</span>
        <small>{variant === 'source' ? 'Sintaxis completa visible' : 'El formato aparece mientras escribes'}</small>
      </div>
      <div ref={hostRef} className="live-editor-host" style={EDITOR_HOST_STYLE} />
    </section>
  )
}
