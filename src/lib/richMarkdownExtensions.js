import { Node } from '@tiptap/core'

const SAFE_FOOTNOTE_ID = /[^\p{L}\p{N}_-]/gu

function normaliseFootnoteId(value) {
  return String(value ?? '1').replace(SAFE_FOOTNOTE_ID, '') || '1'
}

export const FootnoteReference = Node.create({
  name: 'footnoteReference',
  priority: 1100,
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,

  addAttributes() {
    return { id: { default: '1' } }
  },

  parseHTML() {
    return [{
      tag: 'sup[data-footnote-reference]',
      getAttrs: (element) => ({ id: element.getAttribute('data-footnote-reference') || '1' }),
    }]
  },

  renderHTML({ node }) {
    const id = normaliseFootnoteId(node.attrs.id)
    return ['sup', {
      'data-footnote-reference': id,
      class: 'rich-footnote-reference',
      contenteditable: 'false',
      title: `Nota al pie ${id}`,
    }, `[${id}]`]
  },

  parseMarkdown: (token, helpers) => helpers.createNode('footnoteReference', { id: token.id }),
  renderMarkdown: (node) => `[^${normaliseFootnoteId(node.attrs?.id)}]`,
  markdownTokenizer: {
    name: 'footnoteReference',
    level: 'inline',
    start: (source) => source.indexOf('[^'),
    tokenize(source) {
      const match = /^\[\^([^\]\n]+)\]/.exec(source)
      if (!match) return undefined
      return {
        type: 'footnoteReference',
        raw: match[0],
        id: normaliseFootnoteId(match[1]),
      }
    },
  },
})

export const FootnoteDefinition = Node.create({
  name: 'footnoteDefinition',
  // Keep paragraphs ahead of this atom in the schema. ProseMirror fills an
  // empty document with the first available block node; a higher priority here
  // made every new rich document start with a synthetic footnote definition.
  priority: 90,
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: '1' },
      text: { default: 'Nota al pie' },
    }
  },

  parseHTML() {
    return [{
      tag: 'aside[data-footnote-definition]',
      getAttrs: (element) => ({
        id: element.getAttribute('data-footnote-definition') || '1',
        text: element.getAttribute('data-footnote-text') || element.textContent || 'Nota al pie',
      }),
    }]
  },

  renderHTML({ node }) {
    const id = normaliseFootnoteId(node.attrs.id)
    return ['aside', {
      'data-footnote-definition': id,
      'data-footnote-text': node.attrs.text,
      class: 'rich-footnote-definition',
      contenteditable: 'false',
    },
    ['span', { class: 'rich-footnote-label' }, `Nota ${id}`],
    ['span', { class: 'rich-footnote-text' }, node.attrs.text || 'Nota al pie']]
  },

  parseMarkdown: (token, helpers) => helpers.createNode('footnoteDefinition', {
    id: token.id,
    text: token.text || 'Nota al pie',
  }),
  renderMarkdown: (node) => {
    const id = normaliseFootnoteId(node.attrs?.id)
    const text = String(node.attrs?.text || 'Nota al pie').replace(/\n/g, '\n  ')
    return `[^${id}]: ${text}`
  },
  markdownTokenizer: {
    name: 'footnoteDefinition',
    level: 'block',
    start(source) {
      const index = source.search(/^\[\^[^\]\n]+\]:/m)
      return index < 0 ? -1 : index
    },
    tokenize(source) {
      const firstLine = /^\[\^([^\]\n]+)\]:[ \t]*(.*)(?:\n|$)/.exec(source)
      if (!firstLine) return undefined

      let raw = firstLine[0]
      const lines = [firstLine[2]]
      let remainder = source.slice(raw.length)
      while (remainder) {
        const continuation = /^(?: {2,}|\t)(.*)(?:\n|$)/.exec(remainder)
        if (!continuation) break
        raw += continuation[0]
        lines.push(continuation[1])
        remainder = source.slice(raw.length)
      }

      return {
        type: 'footnoteDefinition',
        raw,
        id: normaliseFootnoteId(firstLine[1]),
        text: lines.join('\n').trim() || 'Nota al pie',
      }
    },
  },
})

export function richFootnoteExtensions() {
  return [FootnoteReference, FootnoteDefinition]
}
