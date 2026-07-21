import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getFormattingState,
  removeLink,
  setHeading,
  setLink,
  toggleBold,
  toggleHeading,
  toggleInlineCode,
  toggleItalic,
  toggleLink,
  toggleList,
  toggleQuote,
} from './formatting.js'

test('bold wraps a selection and keeps the content selected', () => {
  assert.deepEqual(toggleBold('hola mundo', 0, 4), {
    text: '**hola** mundo',
    selectionStart: 2,
    selectionEnd: 6,
  })
})

test('bold is removed when the cursor is inside the formatted content', () => {
  assert.deepEqual(toggleBold('Antes **hola** después', 10, 10), {
    text: 'Antes hola después',
    selectionStart: 8,
    selectionEnd: 8,
  })
})

test('bold is removed when its complete markup is selected', () => {
  assert.deepEqual(toggleBold('**hola**', 0, 8), {
    text: 'hola',
    selectionStart: 0,
    selectionEnd: 4,
  })
})

test('italic inserts a selectable placeholder at a collapsed cursor', () => {
  assert.deepEqual(toggleItalic('Escribe: ', 9, 9), {
    text: 'Escribe: _texto_',
    selectionStart: 10,
    selectionEnd: 15,
  })
})

test('inline code toggles without duplicating backticks', () => {
  const applied = toggleInlineCode('constante', 0, 9)
  assert.deepEqual(applied, {
    text: '`constante`',
    selectionStart: 1,
    selectionEnd: 10,
  })
  assert.deepEqual(toggleInlineCode(applied.text, 4, 4), {
    text: 'constante',
    selectionStart: 3,
    selectionEnd: 3,
  })
})

test('formatting state detects inline formats around a cursor or selection', () => {
  const text = '**negrita** y _cursiva_ y `código`'
  assert.equal(getFormattingState(text, 4, 4).bold, true)
  assert.equal(getFormattingState(text, 17, 17).italic, true)
  assert.equal(getFormattingState(text, text.indexOf('código') + 2).code, true)
  assert.equal(getFormattingState(text, text.length, text.length).code, false)
})

test('list toggles every selected line and restores the original selection content', () => {
  const applied = toggleList('uno\ndos', 0, 7)
  assert.deepEqual(applied, {
    text: '- uno\n- dos',
    selectionStart: 2,
    selectionEnd: 11,
  })
  assert.deepEqual(toggleList(applied.text, 0, applied.text.length), {
    text: 'uno\ndos',
    selectionStart: 0,
    selectionEnd: 7,
  })
})

test('list fills only missing markers in a mixed selection', () => {
  assert.deepEqual(toggleList('- uno\ndos', 0, 9), {
    text: '- uno\n- dos',
    selectionStart: 0,
    selectionEnd: 11,
  })
})

test('list recognizes and removes alternative bullet markers', () => {
  assert.equal(toggleList('* uno\n+ dos', 0, 11).text, 'uno\ndos')
})

test('list inserts a useful item on an empty line', () => {
  assert.deepEqual(toggleList('', 0, 0), {
    text: '- Un elemento',
    selectionStart: 2,
    selectionEnd: 13,
  })
})

test('quote toggles all selected lines and preserves indentation', () => {
  const applied = toggleQuote('  uno\n  dos', 0, 11)
  assert.deepEqual(applied, {
    text: '  > uno\n  > dos',
    selectionStart: 0,
    selectionEnd: 15,
  })
  assert.equal(toggleQuote(applied.text, 0, applied.text.length).text, '  uno\n  dos')
})

test('line format state reports list and quote only when every content line has it', () => {
  assert.equal(getFormattingState('- uno\n- dos', 0, 11).list, true)
  assert.equal(getFormattingState('- uno\ndos', 0, 9).list, false)
  assert.equal(getFormattingState('> uno\n> dos', 0, 11).quote, true)
})

test('setHeading applies H1-H6 and replaces an existing heading level', () => {
  assert.deepEqual(setHeading('## Uno\ntexto', 0, 12, 3), {
    text: '### Uno\n### texto',
    selectionStart: 4,
    selectionEnd: 17,
  })
})

test('setHeading level zero converts headings to paragraphs', () => {
  assert.equal(setHeading('# Uno\n### Dos', 0, 13, 0).text, 'Uno\nDos')
})

test('toggleHeading removes the selected level on a second activation', () => {
  assert.equal(toggleHeading('## Título', 4, 4, 2).text, 'Título')
  assert.equal(toggleHeading('Título', 2, 2, 2).text, '## Título')
})

test('heading state is a level, zero for paragraphs, and null for a mixed selection', () => {
  assert.equal(getFormattingState('### Título', 5, 5).heading, 3)
  assert.equal(getFormattingState('Párrafo', 2, 2).heading, 0)
  assert.equal(getFormattingState('# Uno\n## Dos', 0, 12).heading, null)
})

test('setHeading inserts a selectable placeholder on an empty line', () => {
  assert.deepEqual(setHeading('', 0, 0, 4), {
    text: '#### Un buen título',
    selectionStart: 5,
    selectionEnd: 19,
  })
})

test('invalid heading levels fail clearly', () => {
  assert.throws(() => setHeading('texto', 0, 0, 7), RangeError)
})

test('setLink creates a link around a selection', () => {
  assert.deepEqual(setLink('Visita Línea', 7, 12, { url: 'https://linea.test' }), {
    text: 'Visita [Línea](https://linea.test)',
    selectionStart: 8,
    selectionEnd: 13,
  })
})

test('setLink edits the link containing the cursor instead of nesting it', () => {
  assert.deepEqual(setLink('[Línea](https://old.test)', 3, 3, { url: 'https://new.test' }), {
    text: '[Línea](https://new.test)',
    selectionStart: 1,
    selectionEnd: 6,
  })
})

test('setLink flattens links contained by a larger new selection', () => {
  assert.equal(
    setLink('Consulta [Línea](https://old.test) hoy', 0, 38, { url: 'https://new.test' }).text,
    '[Consulta Línea hoy](https://new.test)',
  )
})

test('removeLink keeps the visible label', () => {
  assert.deepEqual(removeLink('Abre [Línea](https://linea.test)', 8, 8), {
    text: 'Abre Línea',
    selectionStart: 5,
    selectionEnd: 10,
  })
})

test('toggleLink removes an active link and creates an inactive one', () => {
  assert.equal(toggleLink('[uno](https://uno.test)', 2, 2).text, 'uno')
  assert.equal(toggleLink('uno', 0, 3, { url: 'https://uno.test' }).text, '[uno](https://uno.test)')
})

test('link state exposes editable metadata', () => {
  assert.deepEqual(getFormattingState('[Línea](https://linea.test)', 2, 2).linkData, {
    label: 'Línea',
    url: 'https://linea.test',
    start: 0,
    end: 27,
    labelStart: 1,
    labelEnd: 6,
  })
})

test('selection indexes are normalized and clamped', () => {
  assert.deepEqual(toggleBold('hola', 99, -4), {
    text: '**hola**',
    selectionStart: 2,
    selectionEnd: 6,
  })
})
