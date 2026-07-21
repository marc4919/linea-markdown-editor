import { StateEffect, StateField } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'

const INLINE_DECORATIONS = new Map([
  ['StrongEmphasis', 'cm-live-strong'],
  ['Emphasis', 'cm-live-emphasis'],
  ['Strikethrough', 'cm-live-strikethrough'],
  ['InlineCode', 'cm-live-inline-code'],
  ['Link', 'cm-live-link'],
])

const setLiveVariant = StateEffect.define()

const liveVariantField = StateField.define({
  create: () => 'live',
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setLiveVariant)) return normaliseVariant(effect.value)
    }
    return value
  },
})

function normaliseVariant(variant) {
  return variant === 'source' ? 'source' : 'live'
}

function headingLevel(nodeName) {
  const match = /^(?:ATX|Setext)Heading([1-6])$/.exec(nodeName)
  return match ? Number(match[1]) : 0
}

function nodeTouchesLine(document, from, to, lineNumber) {
  const safeFrom = Math.max(0, Math.min(from, document.length))
  const safeEnd = Math.max(safeFrom, Math.min(Math.max(from, to - 1), document.length))
  const firstLine = document.lineAt(safeFrom).number
  const lastLine = document.lineAt(safeEnd).number
  return lineNumber >= firstLine && lineNumber <= lastLine
}

function isHiddenMarker(nodeName, parentName) {
  if (nodeName === 'HeaderMark' || nodeName === 'EmphasisMark' || nodeName === 'StrikethroughMark') return true
  if (nodeName === 'CodeMark') return parentName === 'InlineCode'
  if (parentName !== 'Link') return false
  return nodeName === 'LinkMark' || nodeName === 'URL' || nodeName === 'LinkLabel' || nodeName === 'LinkTitle'
}

/**
 * Returns a serialisable representation of the visual treatment for a state.
 * Keeping tree traversal separate from CodeMirror's Decoration objects makes
 * the behaviour straightforward to test without mounting a browser editor.
 */
export function collectLiveMarkdownDecorationSpecs(state, { from = 0, to = state.doc.length } = {}) {
  const activeLine = state.doc.lineAt(state.selection.main.head)
  const specs = []

  syntaxTree(state).iterate({
    from: Math.max(0, from),
    to: Math.min(state.doc.length, to),
    enter(node) {
      const nodeName = node.name
      const parentName = node.node.parent?.name || ''
      const level = headingLevel(nodeName)

      if (level) {
        specs.push({
          kind: 'line',
          from: state.doc.lineAt(node.from).from,
          to: state.doc.lineAt(node.from).from,
          className: `cm-live-heading cm-live-heading-${level}`,
        })
      }

      const inlineClass = INLINE_DECORATIONS.get(nodeName)
      if (inlineClass && node.from < node.to) {
        specs.push({ kind: 'mark', from: node.from, to: node.to, className: inlineClass })
      }

      if (
        node.from < node.to
        && isHiddenMarker(nodeName, parentName)
        && !nodeTouchesLine(state.doc, node.from, node.to, activeLine.number)
      ) {
        specs.push({ kind: 'replace', from: node.from, to: node.to })
      }
    },
  })

  return specs
}

function buildDecorations(view) {
  if (view.state.field(liveVariantField, false) !== 'live') return Decoration.none

  const specs = collectLiveMarkdownDecorationSpecs(view.state, view.viewport)
  const ranges = specs.map((spec) => {
    if (spec.kind === 'line') {
      return Decoration.line({ attributes: { class: spec.className } }).range(spec.from)
    }
    if (spec.kind === 'replace') return Decoration.replace({}).range(spec.from, spec.to)
    return Decoration.mark({ class: spec.className }).range(spec.from, spec.to)
  })

  return Decoration.set(ranges, true)
}

function variantChanged(update) {
  return update.transactions.some((transaction) => (
    transaction.effects.some((effect) => effect.is(setLiveVariant))
  ))
}

const liveDecorations = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = buildDecorations(view)
  }

  update(update) {
    if (update.docChanged || update.selectionSet || update.viewportChanged || variantChanged(update)) {
      this.decorations = buildDecorations(update.view)
    }
  }
}, {
  decorations: (plugin) => plugin.decorations,
})

const liveEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    minHeight: '0',
    backgroundColor: 'transparent',
    color: '#2c2925',
    fontSize: '14px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--mono)',
    lineHeight: '1.67',
    letterSpacing: '-.01em',
  },
  '.cm-content': {
    minHeight: '100%',
    padding: '18px 0 70px',
    caretColor: 'var(--accent)',
  },
  '.cm-line': { padding: '0 22px' },
  '.cm-content span': { textDecoration: 'none' },
  '.cm-gutters': {
    minWidth: '52px',
    borderRight: '1px solid var(--line-soft)',
    backgroundColor: 'transparent',
    color: 'var(--faint)',
    fontFamily: 'var(--mono)',
    fontSize: '13px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '51px',
    padding: '0 12px 0 6px',
  },
  '.cm-foldGutter': { display: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: '#f7d2ce',
  },
  '.cm-live-heading': {
    fontFamily: 'var(--serif)',
    letterSpacing: '-.02em',
    textDecoration: 'none',
  },
  '.cm-live-heading span': { textDecoration: 'none' },
  '.cm-live-heading-1': {
    paddingTop: '0.38em',
    paddingBottom: '0.18em',
    fontSize: '2.2em',
    fontWeight: '600',
    lineHeight: '1.16',
  },
  '.cm-live-heading-2': {
    paddingTop: '0.32em',
    paddingBottom: '0.12em',
    fontSize: '1.72em',
    fontWeight: '600',
    lineHeight: '1.2',
  },
  '.cm-live-heading-3': {
    paddingTop: '0.26em',
    fontSize: '1.38em',
    fontWeight: '650',
    lineHeight: '1.28',
  },
  '.cm-live-heading-4': { fontSize: '1.16em', fontWeight: '700' },
  '.cm-live-heading-5, .cm-live-heading-6': {
    fontFamily: 'var(--ui)',
    fontSize: '.88em',
    fontWeight: '700',
    letterSpacing: '.055em',
    textTransform: 'uppercase',
  },
  '.cm-live-strong': { fontWeight: '750' },
  '.cm-live-emphasis': { fontStyle: 'italic' },
  '.cm-live-strikethrough': { textDecoration: 'line-through' },
  '.cm-live-inline-code': {
    padding: '.12em .32em',
    border: '1px solid #e3ddd6',
    borderRadius: '4px',
    backgroundColor: '#f7f3ef',
    color: 'var(--accent)',
    fontFamily: 'var(--mono)',
    fontSize: '.9em',
  },
  '.cm-live-link': {
    color: 'var(--accent)',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
  },
})

export function liveMarkdownExtensions(initialVariant = 'live') {
  const variant = normaliseVariant(initialVariant)
  return [
    liveVariantField.init(() => variant),
    liveDecorations,
    liveEditorTheme,
  ]
}

export function updateLiveMarkdownVariant(view, variant) {
  const nextVariant = normaliseVariant(variant)
  if (view.state.field(liveVariantField, false) === nextVariant) return
  view.dispatch({ effects: setLiveVariant.of(nextVariant) })
}
