import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_DOCUMENT_FILENAME,
  LEGACY_DOCUMENT_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  activateTab,
  closeTab,
  createTab,
  createWorkspace,
  deserializeWorkspace,
  editTab,
  getActiveTab,
  getNextUntitledFilename,
  getTab,
  loadWorkspace,
  markTabExported,
  migrateLegacyDocument,
  needsDiscardConfirmation,
  renameTab,
  replaceTab,
  restoreWorkspace,
  saveWorkspace,
  serializeWorkspace,
  validateWorkspace,
} from '../src/lib/workspace.js'

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries))
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
    value(key) {
      return values.get(key)
    },
  }
}

test('crea pestañas con IDs únicos, secuenciales y nombres previsibles', () => {
  const initial = createWorkspace()
  const second = createTab(initial)
  const third = createTab(second, { activate: false })

  assert.equal(initial.tabs[0].id, 'tab-1')
  assert.deepEqual(third.tabs.map((tab) => tab.id), ['tab-1', 'tab-2', 'tab-3'])
  assert.deepEqual(
    third.tabs.map((tab) => tab.filename),
    ['sin-titulo.md', 'sin-titulo-2.md', 'sin-titulo-3.md'],
  )
  assert.equal(third.activeTabId, 'tab-2')
  assert.equal(third.nextTabNumber, 4)
  assert.notEqual(third, initial)
})

test('no reutiliza IDs después de cerrar una pestaña', () => {
  const withSecond = createTab(createWorkspace())
  const closed = closeTab(withSecond, 'tab-2')
  const created = createTab(closed)

  assert.deepEqual(created.tabs.map((tab) => tab.id), ['tab-1', 'tab-3'])
})

test('activa, renombra y edita de forma inmutable', () => {
  const initial = createTab(createWorkspace(), {
    filename: 'ideas.md',
    markdown: 'Inicial',
    exported: true,
  })
  const activated = activateTab(initial, 'tab-1')
  const renamed = renameTab(activated, 'tab-1', '')
  const edited = editTab(renamed, 'tab-1', '')

  assert.equal(initial.tabs[0].filename, DEFAULT_DOCUMENT_FILENAME)
  assert.equal(activated.activeTabId, 'tab-1')
  assert.equal(getActiveTab(edited).id, 'tab-1')
  assert.equal(getTab(edited, 'tab-1').filename, '')
  assert.equal(getTab(edited, 'tab-1').markdown, '')
  assert.equal(getTab(edited, 'tab-1').dirty, true)
  assert.equal(getTab(edited, 'tab-1').exported, false)
})

test('las operaciones sin cambios conservan la referencia del workspace', () => {
  const workspace = createWorkspace({ filename: 'nota.md', markdown: 'texto' })

  assert.equal(activateTab(workspace, 'tab-1'), workspace)
  assert.equal(renameTab(workspace, 'tab-1', 'nota.md'), workspace)
  assert.equal(editTab(workspace, 'tab-1', 'texto'), workspace)
})

test('reemplazar conserva el ID y considera limpio un fichero recién abierto', () => {
  const dirty = editTab(createWorkspace(), 'tab-1', 'borrador')
  const replaced = replaceTab(dirty, 'tab-1', {
    filename: 'externo.md',
    markdown: '',
  })
  const tab = getActiveTab(replaced)

  assert.equal(tab.id, 'tab-1')
  assert.equal(tab.filename, 'externo.md')
  assert.equal(tab.markdown, '')
  assert.equal(tab.dirty, false)
  assert.equal(tab.exported, true)
})

test('marcar como exportado limpia el estado sin modificar el contenido', () => {
  const dirty = editTab(createWorkspace(), 'tab-1', '# Hecho')
  const exported = markTabExported(dirty, 'tab-1', { filename: 'hecho.md' })
  const tab = getActiveTab(exported)

  assert.equal(tab.filename, 'hecho.md')
  assert.equal(tab.markdown, '# Hecho')
  assert.equal(tab.dirty, false)
  assert.equal(tab.exported, true)
  assert.equal(needsDiscardConfirmation(tab), false)
})

test('avisa antes de perder cambios o contenido que nunca se exportó', () => {
  const empty = getActiveTab(createWorkspace())
  const localContent = getActiveTab(createWorkspace({ markdown: 'Sólo local' }))
  const imported = getActiveTab(createWorkspace({
    markdown: 'Existe fuera',
    exported: true,
  }))
  const changed = { ...imported, dirty: true }

  assert.equal(needsDiscardConfirmation(empty), false)
  assert.equal(needsDiscardConfirmation(localContent), true)
  assert.equal(needsDiscardConfirmation(imported), false)
  assert.equal(needsDiscardConfirmation(changed), true)
})

test('cierra pestañas y elige de forma determinista la siguiente activa', () => {
  let workspace = createWorkspace()
  workspace = createTab(workspace, { filename: 'dos.md' })
  workspace = createTab(workspace, { filename: 'tres.md' })

  const middleActive = activateTab(workspace, 'tab-2')
  const closedMiddle = closeTab(middleActive, 'tab-2')
  const closedRight = closeTab(closedMiddle, 'tab-3')

  assert.equal(closedMiddle.activeTabId, 'tab-3')
  assert.equal(closedRight.activeTabId, 'tab-1')
})

test('al cerrar la última pestaña crea una nueva y permite optar por un workspace vacío', () => {
  const initial = createWorkspace({ markdown: 'adiós' })
  const replacement = closeTab(initial, 'tab-1')
  const empty = closeTab(initial, 'tab-1', { ensureOne: false })

  assert.equal(replacement.tabs.length, 1)
  assert.equal(replacement.activeTabId, 'tab-2')
  assert.equal(replacement.tabs[0].markdown, '')
  assert.equal(empty.tabs.length, 0)
  assert.equal(empty.activeTabId, null)
  assert.equal(validateWorkspace(empty).valid, true)
})

test('migra linea-document-v1 sin perder nombre ni documento vacíos', () => {
  const migrated = migrateLegacyDocument(JSON.stringify({ filename: '', markdown: '' }), {
    defaultFilename: 'fallback.md',
    defaultMarkdown: 'fallback',
  })
  const tab = getActiveTab(migrated)

  assert.equal(tab.filename, '')
  assert.equal(tab.markdown, '')
  assert.equal(tab.dirty, false)
  assert.equal(tab.exported, false)
})

test('serializa y deserializa v2 preservando exactamente cadenas vacías', () => {
  const workspace = renameTab(createWorkspace(), 'tab-1', '')
  const serialized = serializeWorkspace(workspace)

  assert.equal(serialized.ok, true)
  const restored = deserializeWorkspace(serialized.value)
  assert.equal(restored.ok, true)
  assert.deepEqual(restored.workspace, workspace)
  assert.equal(restored.workspace.tabs[0].filename, '')
  assert.equal(restored.workspace.tabs[0].markdown, '')
})

test('rechaza JSON corrupto, IDs duplicados y activeTabId huérfano sin lanzar', () => {
  const invalidJson = deserializeWorkspace('{')
  const workspace = createTab(createWorkspace())
  const duplicateIds = {
    ...workspace,
    tabs: workspace.tabs.map((tab) => ({ ...tab, id: 'igual' })),
    activeTabId: 'igual',
  }
  const orphan = { ...createWorkspace(), activeTabId: 'no-existe' }

  assert.equal(invalidJson.ok, false)
  assert.equal(serializeWorkspace(duplicateIds).ok, false)
  assert.equal(validateWorkspace(orphan).valid, false)
})

test('carga v2 con prioridad sobre v1', () => {
  const v2 = createWorkspace({ filename: 'v2.md', markdown: 'nuevo' })
  const serialized = serializeWorkspace(v2)
  const storage = memoryStorage({
    [WORKSPACE_STORAGE_KEY]: serialized.value,
    [LEGACY_DOCUMENT_STORAGE_KEY]: JSON.stringify({ filename: 'v1.md', markdown: 'viejo' }),
  })

  const loaded = loadWorkspace(storage)

  assert.equal(loaded.ok, true)
  assert.equal(loaded.source, 'v2')
  assert.equal(getActiveTab(loaded.workspace).filename, 'v2.md')
})

test('migra v1 desde almacenamiento y restoreWorkspace persiste v2', () => {
  const storage = memoryStorage({
    [LEGACY_DOCUMENT_STORAGE_KEY]: JSON.stringify({ filename: 'legado.md', markdown: '' }),
  })

  const restored = restoreWorkspace(storage)

  assert.equal(restored.ok, true)
  assert.equal(restored.source, 'legacy')
  assert.equal(restored.migrated, true)
  assert.equal(restored.migrationSaved, true)
  assert.equal(getActiveTab(restored.workspace).markdown, '')

  const persisted = deserializeWorkspace(storage.value(WORKSPACE_STORAGE_KEY))
  assert.equal(persisted.ok, true)
  assert.equal(getActiveTab(persisted.workspace).filename, 'legado.md')
})

test('si v2 está corrupto recupera v1 y conserva el aviso', () => {
  const storage = memoryStorage({
    [WORKSPACE_STORAGE_KEY]: '{no',
    [LEGACY_DOCUMENT_STORAGE_KEY]: JSON.stringify({ filename: 'rescate.md', markdown: 'ok' }),
  })

  const loaded = loadWorkspace(storage)

  assert.equal(loaded.ok, true)
  assert.equal(loaded.source, 'legacy')
  assert.equal(loaded.warnings.length, 1)
  assert.equal(getActiveTab(loaded.workspace).filename, 'rescate.md')
})

test('los helpers de almacenamiento devuelven errores en vez de lanzar', () => {
  const unavailableLoad = loadWorkspace(null, { defaultMarkdown: '' })
  const unavailableSave = saveWorkspace(null, createWorkspace())
  const failingStorage = {
    getItem() {
      throw new Error('privacidad')
    },
    setItem() {
      throw new Error('cuota')
    },
  }
  const failedLoad = loadWorkspace(failingStorage)
  const failedSave = saveWorkspace(failingStorage, createWorkspace())

  assert.equal(unavailableLoad.ok, false)
  assert.equal(unavailableLoad.workspace.tabs[0].markdown, '')
  assert.equal(unavailableSave.error.code, 'STORAGE_UNAVAILABLE')
  assert.equal(failedLoad.error.code, 'STORAGE_READ_FAILED')
  assert.equal(failedSave.error.code, 'STORAGE_WRITE_FAILED')
})

test('calcula nombres sin colisiones sin alterar el workspace', () => {
  let workspace = createWorkspace({ filename: 'Nota.md' })
  workspace = createTab(workspace, { filename: 'nota-2.md' })

  assert.equal(getNextUntitledFilename(workspace, 'nota.md'), 'nota-3.md')
  assert.equal(workspace.tabs.length, 2)
})
