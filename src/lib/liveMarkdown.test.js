import assert from 'node:assert/strict'
import test from 'node:test'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { collectLiveMarkdownDecorationSpecs } from './liveMarkdown.js'

const tick = String.fromCharCode(96)
const sample = `# Título\n\n**negrita** *cursiva* ~~tachado~~ ${tick}código${tick} [sitio](https://example.com)`

function stateAt(position) {
  return EditorState.create({
    doc: sample,
    selection: { anchor: position },
    extensions: [markdown({ base: markdownLanguage })],
  })
}

test('Live mode decorates supported inline Markdown and headings', () => {
  const specs = collectLiveMarkdownDecorationSpecs(stateAt(0))
  const classes = new Set(specs.map((spec) => spec.className).filter(Boolean))

  assert.ok(classes.has('cm-live-heading cm-live-heading-1'))
  assert.ok(classes.has('cm-live-strong'))
  assert.ok(classes.has('cm-live-emphasis'))
  assert.ok(classes.has('cm-live-strikethrough'))
  assert.ok(classes.has('cm-live-inline-code'))
  assert.ok(classes.has('cm-live-link'))
})

test('Live mode hides markers outside the active line', () => {
  const state = stateAt(0)
  const hiddenText = collectLiveMarkdownDecorationSpecs(state)
    .filter((spec) => spec.kind === 'replace')
    .map((spec) => state.doc.sliceString(spec.from, spec.to))

  assert.ok(hiddenText.includes('**'))
  assert.ok(hiddenText.includes('~~'))
  assert.ok(hiddenText.includes(tick))
  assert.ok(hiddenText.includes('https://example.com'))
  assert.equal(hiddenText.includes('#'), false)
})

test('Live mode reveals every marker on the active line', () => {
  const inlineLinePosition = sample.indexOf('negrita')
  const state = stateAt(inlineLinePosition)
  const hiddenText = collectLiveMarkdownDecorationSpecs(state)
    .filter((spec) => spec.kind === 'replace')
    .map((spec) => state.doc.sliceString(spec.from, spec.to))

  assert.deepEqual(hiddenText, ['#'])
})
