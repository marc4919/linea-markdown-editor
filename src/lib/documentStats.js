import { extractMarkdownText } from './markdown.js'

const wordSegmenter = typeof Intl?.Segmenter === 'function'
  ? new Intl.Segmenter('es', { granularity: 'word' })
  : null
const characterSegmenter = typeof Intl?.Segmenter === 'function'
  ? new Intl.Segmenter('es', { granularity: 'grapheme' })
  : null

export function getDocumentStats(markdown) {
  const visible = extractMarkdownText(markdown)
  const wordText = visible.replace(/[\r\n]+/g, ' ')
  const characterText = visible.replace(/[\r\n]+/g, '')
  const words = wordSegmenter
    ? [...wordSegmenter.segment(wordText)].filter((segment) => segment.isWordLike).length
    : (wordText.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []).length
  const characters = characterSegmenter
    ? [...characterSegmenter.segment(characterText)].length
    : Array.from(characterText).length

  return { words, characters }
}
