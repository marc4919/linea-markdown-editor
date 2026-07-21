import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createMermaidSource,
  createTableMarkdown,
  getDefaultMermaidSpec,
  insertConfiguredTable,
  insertConfiguredMermaid,
} from './advancedBuilders.js'

test('crea una tabla configurable con cabecera y filas de datos', () => {
  const markdown = createTableMarkdown({
    columns: 3,
    bodyRows: 2,
    headers: ['Nombre', 'Estado', 'Responsable'],
  })

  assert.equal(markdown, [
    '| Nombre | Estado | Responsable |',
    '| --- | --- | --- |',
    '| Dato | Dato | Dato |',
    '| Dato | Dato | Dato |',
  ].join('\n'))
})

test('normaliza cabeceras vacías y escapa contenido que rompería una tabla', () => {
  const markdown = createTableMarkdown({
    columns: 2,
    bodyRows: 1,
    headers: ['Ruta \\ principal | copia\nfinal', ''],
    cellPlaceholder: 'A | B',
  })

  assert.match(markdown, /^\| Ruta \\\\ principal \\\| copia final \| Columna 2 \|/)
  assert.match(markdown, /\| A \\\| B \| A \\\| B \|$/)
})

test('limita el tamaño de las tablas antes de generar contenido excesivo', () => {
  assert.throws(() => createTableMarkdown({ columns: 13, bodyRows: 1 }), /entre 1 y 12/)
  assert.throws(() => createTableMarkdown({ columns: 2, bodyRows: 51 }), /entre 1 y 50/)
  assert.throws(() => createTableMarkdown({ columns: 2.5, bodyRows: 1 }), /número entero/)
  const longHeader = createTableMarkdown({ columns: 1, bodyRows: 1, headers: ['x'.repeat(500)] }).split('\n')[0]
  assert.equal(longHeader, `| ${'x'.repeat(160)} |`)
})

test('inserta una tabla como bloque y selecciona su primera cabecera', () => {
  const edit = insertConfiguredTable('Antes después', 6, 13, {
    columns: 2,
    bodyRows: 1,
    headers: ['Primera', 'Segunda'],
  })

  assert.match(edit.text, /^\| Primera \| Segunda \|[\s\S]*Antes después$/)
  assert.equal(edit.text.slice(edit.selectionStart, edit.selectionEnd), 'Primera')
})

test('inserta Mermaid configurado como un bloque y conserva su código seleccionado', () => {
  const source = 'flowchart LR\n  Idea --> Publicación'
  const edit = insertConfiguredMermaid('Antes después', 6, 13, source)
  assert.match(edit.text, /^```mermaid\nflowchart LR[\s\S]*Antes después$/)
  assert.equal(edit.text.slice(edit.selectionStart, edit.selectionEnd), source)
})

test('inserta bloques antes de la línea actual sin borrar una celda seleccionada', () => {
  const document = [
    '| Producto | Estado |',
    '| --- | --- |',
    '| Línea | Listo |',
  ].join('\n')
  const start = document.indexOf('Producto')
  const source = 'flowchart TD\n  Idea --> Publicación'

  const tableEdit = insertConfiguredTable(document, start, start + 'Producto'.length, {
    columns: 2,
    bodyRows: 1,
    headers: ['Nueva', 'Tabla'],
  })
  const mermaidEdit = insertConfiguredMermaid(document, start, start + 'Producto'.length, source)

  assert.match(tableEdit.text, /^\| Nueva \| Tabla \|[\s\S]*\| Producto \| Estado \|$/m)
  assert.match(mermaidEdit.text, /^```mermaid[\s\S]*\| Producto \| Estado \|$/m)
  assert.equal(tableEdit.text.includes('| Producto | Estado |'), true)
  assert.equal(mermaidEdit.text.includes('| Producto | Estado |'), true)
})

test('no parte una tabla al insertar desde una fila de datos', () => {
  const document = [
    'Antes',
    '',
    '| Producto | Estado |',
    '| --- | --- |',
    '| Línea | Listo |',
    '| Editor | Activo |',
    '',
    'Después',
  ].join('\n')
  const start = document.indexOf('Línea')
  const edit = insertConfiguredMermaid(document, start, start + 'Línea'.length, 'flowchart LR\n  A --> B')

  assert.match(edit.text, /```mermaid[\s\S]*```\n\n\| Producto \| Estado \|\n\| --- \| --- \|\n\| Línea \| Listo \|\n\| Editor \| Activo \|/)
})

test('reconoce tablas GFM sin barras exteriores al insertar', () => {
  const document = [
    'Producto | Estado',
    '--- | ---',
    'Línea | Listo',
    'Editor | Activo',
    '',
    'Después',
  ].join('\n')
  const start = document.indexOf('Línea')
  const edit = insertConfiguredMermaid(document, start, start + 'Línea'.length, 'flowchart LR\n  A --> B')

  assert.match(edit.text, /```mermaid[\s\S]*```\n\nProducto \| Estado\n--- \| ---\nLínea \| Listo\nEditor \| Activo/)
})

test('inserta fuera de un bloque cercado aunque el cursor esté dentro', () => {
  const document = [
    'Antes',
    '',
    '```js',
    'const seleccionado = true',
    '```',
    '',
    'Después',
  ].join('\n')
  const start = document.indexOf('seleccionado')
  const table = insertConfiguredTable(document, start, start + 'seleccionado'.length, {
    columns: 2,
    bodyRows: 1,
    headers: ['A', 'B'],
  })
  const diagram = insertConfiguredMermaid(document, start, start + 'seleccionado'.length, 'flowchart LR\n  A --> B')

  assert.match(table.text, /\| A \| B \|[\s\S]*\n\n```js\nconst seleccionado = true\n```/)
  assert.match(diagram.text, /```mermaid[\s\S]*```\n\n```js\nconst seleccionado = true\n```/)
})

test('inserta fuera de fences contenidos en citas o listas', () => {
  const quote = [
    '> ```js',
    '> const seleccionado = true',
    '> ```',
    '',
    'Después',
  ].join('\n')
  const list = [
    '- Código:',
    '',
    '  ```js',
    '  const seleccionado = true',
    '  ```',
    '',
    'Después',
  ].join('\n')
  const source = 'flowchart LR\n  A --> B'
  const quotedEdit = insertConfiguredMermaid(quote, quote.indexOf('seleccionado'), quote.indexOf('seleccionado') + 5, source)
  const listedEdit = insertConfiguredMermaid(list, list.indexOf('seleccionado'), list.indexOf('seleccionado') + 5, source)

  assert.match(quotedEdit.text, /^```mermaid[\s\S]*```\n\n> ```js\n> const seleccionado = true\n> ```/)
  assert.match(listedEdit.text, /^```mermaid[\s\S]*```\n\n- Código:[\s\S]*const seleccionado = true/)
})

test('conserva el frontmatter inicial al insertar desde uno de sus campos', () => {
  const document = [
    '---',
    'title: Documento',
    'tags: [ideas, línea]',
    '---',
    '',
    '# Contenido',
  ].join('\n')
  const start = document.indexOf('Documento')
  const edit = insertConfiguredMermaid(document, start, start + 'Documento'.length, 'flowchart LR\n  A --> B')

  assert.match(edit.text, /^---\ntitle: Documento\ntags: \[ideas, línea\]\n---\n\n```mermaid/)
  assert.match(edit.text, /```\n\n# Contenido$/)
})

test('genera un flujo con identificadores internos y etiquetas seguras', () => {
  const source = createMermaidSource({
    type: 'flowchart',
    direction: 'LR',
    steps: ['Idea', 'Borrador"]\n  injected --> node', 'Publicación'],
  })

  assert.match(source, /^flowchart LR/)
  assert.match(source, /n2\["Borrador”］ injected --› node"\]/)
  assert.equal(source.split('\n').filter((line) => line.includes('-->')).length, 2)
})

test('genera secuencias con alias controlados y valida sus referencias', () => {
  const source = createMermaidSource({
    type: 'sequence',
    participants: ['Usuario', 'Línea'],
    messages: [
      { from: 0, to: 1, text: 'Crear\ndocumento', kind: 'message' },
      { from: 1, to: 0, text: 'Listo', kind: 'reply' },
    ],
  })

  assert.match(source, /participant p1 as Usuario/)
  assert.match(source, /p1->>p2: Crear documento/)
  assert.match(source, /p2-->>p1: Listo/)
  assert.throws(() => createMermaidSource({
    type: 'sequence',
    participants: ['A', 'B'],
    messages: [{ from: 0, to: 2, text: 'Fuera' }],
  }), /participante existente/)
})

test('genera cronologías y gráficos circulares con datos configurables', () => {
  const timeline = createMermaidSource({
    type: 'timeline',
    title: 'Plan editorial',
    events: [
      { period: 'Julio', text: 'Borrador' },
      { period: 'Agosto', text: 'Publicación' },
    ],
  })
  const pie = createMermaidSource({
    type: 'pie',
    title: 'Esfuerzo',
    showData: false,
    slices: [
      { label: 'Texto', value: 70 },
      { label: 'Diseño', value: 30 },
    ],
  })

  assert.equal(timeline, 'timeline\n  title Plan editorial\n  Julio : Borrador\n  Agosto : Publicación')
  assert.equal(pie, 'pie\n  title Esfuerzo\n  "Texto" : 70\n  "Diseño" : 30')
})

test('rechaza listas Mermaid excesivas y valores circulares no positivos', () => {
  assert.throws(() => createMermaidSource({
    type: 'flowchart',
    steps: Array.from({ length: 21 }, (_, index) => `Paso ${index}`),
  }), /entre 2 y 20/)
  assert.throws(() => createMermaidSource({
    type: 'pie',
    slices: [{ label: 'A', value: 1 }, { label: 'B', value: 0 }],
  }), /mayor que cero/)
})

test('devuelve copias editables de las configuraciones Mermaid iniciales', () => {
  const first = getDefaultMermaidSpec('sequence')
  const second = getDefaultMermaidSpec('sequence')

  first.participants[0] = 'Cambio'
  first.messages[0].text = 'Otro mensaje'
  assert.equal(second.participants[0], 'Usuario')
  assert.equal(second.messages[0].text, 'Crear documento')
})
