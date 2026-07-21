import assert from 'node:assert/strict'
import test from 'node:test'

import {
  filterCommands,
  getFirstEnabledCommandIndex,
  getNextEnabledCommandIndex,
  isCommandExecutable,
  normalizeCommandSearch,
} from './commandPalette.js'

const commands = [
  { id: 'new', label: 'Nuevo documento' },
  { id: 'rename', label: 'Renombrar documento' },
  { id: 'focus', label: 'Entrar en modo concentración' },
  { id: 'preview', label: 'Cambiar a Vista previa' },
]

test('normaliza mayúsculas, espacios y diacríticos para buscar de forma tolerante', () => {
  assert.equal(normalizeCommandSearch('  CONCENTRACIÓN   '), 'concentracion')
})

test('conserva todos los comandos y su orden cuando la consulta está vacía', () => {
  assert.equal(filterCommands(commands, '  '), commands)
})

test('encuentra etiquetas sin exigir tildes y prioriza coincidencias más directas', () => {
  assert.deepEqual(filterCommands(commands, 'concentracion').map(({ id }) => id), ['focus'])
  assert.deepEqual(filterCommands(commands, 'documento').map(({ id }) => id), ['new', 'rename'])
})

test('admite búsquedas difusas ligeras y consultas con varios términos', () => {
  assert.deepEqual(filterCommands(commands, 'vsta prv').map(({ id }) => id), ['preview'])
  assert.deepEqual(filterCommands(commands, 'rn doc').map(({ id }) => id), ['rename'])
})

test('devuelve una colección vacía cuando no hay coincidencias', () => {
  assert.deepEqual(filterCommands(commands, 'xyz'), [])
})

test('la navegación circular omite comandos deshabilitados', () => {
  const options = [
    { id: 'one', disabled: true },
    { id: 'two' },
    { id: 'three', disabled: true },
    { id: 'four' },
  ]

  assert.equal(getFirstEnabledCommandIndex(options), 1)
  assert.equal(getNextEnabledCommandIndex(options, 1, 1), 3)
  assert.equal(getNextEnabledCommandIndex(options, 3, 1), 1)
  assert.equal(getNextEnabledCommandIndex(options, 1, -1), 3)
})

test('no selecciona una opción cuando todas están deshabilitadas', () => {
  const disabled = [{ disabled: true }, { disabled: true }]
  assert.equal(getFirstEnabledCommandIndex(disabled), -1)
  assert.equal(getNextEnabledCommandIndex(disabled, 0, 1), -1)
  assert.equal(getNextEnabledCommandIndex([], -1, 1), -1)
})

test('sólo permite ejecutar comandos habilitados que tengan una acción', () => {
  const action = () => {}
  assert.equal(isCommandExecutable({ action }), true)
  assert.equal(isCommandExecutable({ action, disabled: true }), false)
  assert.equal(isCommandExecutable({}), false)
  assert.equal(isCommandExecutable(null), false)
})
