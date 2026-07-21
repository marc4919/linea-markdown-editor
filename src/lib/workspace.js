export const WORKSPACE_VERSION = 2
export const WORKSPACE_STORAGE_KEY = 'linea-workspace-v2'
export const LEGACY_DOCUMENT_STORAGE_KEY = 'linea-document-v1'
export const DEFAULT_DOCUMENT_FILENAME = 'sin-titulo.md'

const TAB_ID_PREFIX = 'tab-'

// dirty: el estado actual difiere de su última referencia externa.
// exported: existe o existió una copia externa conocida (abierta o descargada).

export class WorkspaceError extends Error {
  constructor(code, message, cause) {
    super(message)
    this.name = 'WorkspaceError'
    this.code = code
    if (cause !== undefined) this.cause = cause
  }
}

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function workspaceError(code, message, cause) {
  return new WorkspaceError(code, message, cause)
}

function requireString(value, field) {
  if (typeof value !== 'string') {
    throw workspaceError('INVALID_WORKSPACE', `${field} debe ser una cadena de texto.`)
  }
  return value
}

function requireBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw workspaceError('INVALID_WORKSPACE', `${field} debe ser un booleano.`)
  }
  return value
}

function canonicalizeWorkspace(value) {
  if (!isObject(value) || value.version !== WORKSPACE_VERSION) {
    throw workspaceError('INVALID_WORKSPACE', `El workspace debe tener la versión ${WORKSPACE_VERSION}.`)
  }

  if (!Array.isArray(value.tabs)) {
    throw workspaceError('INVALID_WORKSPACE', 'tabs debe ser una lista.')
  }

  if (!Number.isSafeInteger(value.nextTabNumber) || value.nextTabNumber < 1) {
    throw workspaceError('INVALID_WORKSPACE', 'nextTabNumber debe ser un entero positivo.')
  }

  const ids = new Set()
  const tabs = value.tabs.map((tab, index) => {
    if (!isObject(tab)) {
      throw workspaceError('INVALID_WORKSPACE', `tabs[${index}] no es un documento válido.`)
    }

    const id = requireString(tab.id, `tabs[${index}].id`)
    if (!id.trim()) {
      throw workspaceError('INVALID_WORKSPACE', `tabs[${index}].id no puede estar vacío.`)
    }
    if (ids.has(id)) {
      throw workspaceError('INVALID_WORKSPACE', `El ID ${id} está repetido.`)
    }
    ids.add(id)

    return {
      id,
      filename: requireString(tab.filename, `tabs[${index}].filename`),
      markdown: requireString(tab.markdown, `tabs[${index}].markdown`),
      dirty: requireBoolean(tab.dirty, `tabs[${index}].dirty`),
      exported: requireBoolean(tab.exported, `tabs[${index}].exported`),
    }
  })

  const activeTabId = value.activeTabId
  if (tabs.length === 0) {
    if (activeTabId !== null) {
      throw workspaceError('INVALID_WORKSPACE', 'Un workspace vacío debe tener activeTabId a null.')
    }
  } else if (typeof activeTabId !== 'string' || !ids.has(activeTabId)) {
    throw workspaceError('INVALID_WORKSPACE', 'activeTabId debe señalar una pestaña existente.')
  }

  return {
    version: WORKSPACE_VERSION,
    activeTabId,
    nextTabNumber: value.nextTabNumber,
    tabs,
  }
}

function assertWorkspace(workspace) {
  canonicalizeWorkspace(workspace)
}

function assertOptions(options) {
  if (!isObject(options)) {
    throw workspaceError('INVALID_ARGUMENT', 'Las opciones deben ser un objeto.')
  }
}

function makeTab(id, options) {
  return {
    id,
    filename: options.filename,
    markdown: options.markdown,
    dirty: options.dirty,
    exported: options.exported,
  }
}

function allocateTabId(workspace) {
  const usedIds = new Set(workspace.tabs.map((tab) => tab.id))
  let number = workspace.nextTabNumber

  while (usedIds.has(`${TAB_ID_PREFIX}${number}`)) number += 1

  return {
    id: `${TAB_ID_PREFIX}${number}`,
    nextTabNumber: number + 1,
  }
}

function findTabIndex(workspace, tabId) {
  assertWorkspace(workspace)
  const index = workspace.tabs.findIndex((tab) => tab.id === tabId)
  if (index === -1) {
    throw workspaceError('TAB_NOT_FOUND', `No existe la pestaña ${String(tabId)}.`)
  }
  return index
}

function updateTab(workspace, tabId, updater) {
  const index = findTabIndex(workspace, tabId)
  const current = workspace.tabs[index]
  const next = updater(current)

  if (next === current) return workspace

  const tabs = workspace.tabs.slice()
  tabs[index] = next
  return { ...workspace, tabs }
}

function defaultWorkspace(options = {}) {
  return createWorkspace({
    filename: typeof options.defaultFilename === 'string'
      ? options.defaultFilename
      : DEFAULT_DOCUMENT_FILENAME,
    markdown: typeof options.defaultMarkdown === 'string' ? options.defaultMarkdown : '',
    dirty: false,
    exported: false,
  })
}

function errorResult(code, message, cause) {
  return { ok: false, error: workspaceError(code, message, cause) }
}

/**
 * Crea un workspace con una primera pestaña. Los IDs viven en el estado y son
 * secuenciales: dada la misma entrada, las operaciones producen los mismos IDs.
 */
export function createWorkspace(options = {}) {
  assertOptions(options)

  const filename = hasOwn(options, 'filename')
    ? requireString(options.filename, 'filename')
    : DEFAULT_DOCUMENT_FILENAME
  const markdown = hasOwn(options, 'markdown')
    ? requireString(options.markdown, 'markdown')
    : ''
  const dirty = hasOwn(options, 'dirty')
    ? requireBoolean(options.dirty, 'dirty')
    : false
  const exported = hasOwn(options, 'exported')
    ? requireBoolean(options.exported, 'exported')
    : false

  return {
    version: WORKSPACE_VERSION,
    activeTabId: `${TAB_ID_PREFIX}1`,
    nextTabNumber: 2,
    tabs: [makeTab(`${TAB_ID_PREFIX}1`, { filename, markdown, dirty, exported })],
  }
}

export function validateWorkspace(workspace) {
  try {
    canonicalizeWorkspace(workspace)
    return { valid: true, error: null }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof WorkspaceError
        ? error
        : workspaceError('INVALID_WORKSPACE', 'El workspace no es válido.', error),
    }
  }
}

export function getTab(workspace, tabId) {
  return workspace.tabs[findTabIndex(workspace, tabId)]
}

export function getActiveTab(workspace) {
  assertWorkspace(workspace)
  if (workspace.activeTabId === null) return null
  return workspace.tabs.find((tab) => tab.id === workspace.activeTabId) ?? null
}

export function getNextUntitledFilename(workspace, baseFilename = DEFAULT_DOCUMENT_FILENAME) {
  assertWorkspace(workspace)
  requireString(baseFilename, 'baseFilename')
  if (!baseFilename) return ''

  const filenames = new Set(workspace.tabs.map((tab) => tab.filename.toLowerCase()))
  if (!filenames.has(baseFilename.toLowerCase())) return baseFilename

  const dotIndex = baseFilename.lastIndexOf('.')
  const stem = dotIndex > 0 ? baseFilename.slice(0, dotIndex) : baseFilename
  const extension = dotIndex > 0 ? baseFilename.slice(dotIndex) : ''
  let suffix = 2

  while (filenames.has(`${stem}-${suffix}${extension}`.toLowerCase())) suffix += 1
  return `${stem}-${suffix}${extension}`
}

export function createTab(workspace, options = {}) {
  assertWorkspace(workspace)
  assertOptions(options)

  const allocation = allocateTabId(workspace)
  const filename = hasOwn(options, 'filename')
    ? requireString(options.filename, 'filename')
    : getNextUntitledFilename(workspace)
  const markdown = hasOwn(options, 'markdown')
    ? requireString(options.markdown, 'markdown')
    : ''
  const dirty = hasOwn(options, 'dirty')
    ? requireBoolean(options.dirty, 'dirty')
    : false
  const exported = hasOwn(options, 'exported')
    ? requireBoolean(options.exported, 'exported')
    : false
  const activate = hasOwn(options, 'activate')
    ? requireBoolean(options.activate, 'activate')
    : true
  const tab = makeTab(allocation.id, { filename, markdown, dirty, exported })

  return {
    ...workspace,
    activeTabId: activate ? tab.id : workspace.activeTabId,
    nextTabNumber: allocation.nextTabNumber,
    tabs: [...workspace.tabs, tab],
  }
}

export function activateTab(workspace, tabId) {
  findTabIndex(workspace, tabId)
  if (workspace.activeTabId === tabId) return workspace
  return { ...workspace, activeTabId: tabId }
}

export function renameTab(workspace, tabId, filename) {
  requireString(filename, 'filename')
  return updateTab(workspace, tabId, (tab) => {
    if (tab.filename === filename) return tab
    return { ...tab, filename, dirty: true }
  })
}

export function editTab(workspace, tabId, markdown) {
  requireString(markdown, 'markdown')
  return updateTab(workspace, tabId, (tab) => {
    if (tab.markdown === markdown) return tab
    return { ...tab, markdown, dirty: true }
  })
}

/**
 * Sustituye el contenido de una pestaña conservando su ID. Por defecto se
 * interpreta como un fichero recién abierto: existe fuera de la app y está limpio.
 */
export function replaceTab(workspace, tabId, replacement = {}) {
  assertOptions(replacement)
  return updateTab(workspace, tabId, (tab) => {
    const filename = hasOwn(replacement, 'filename')
      ? requireString(replacement.filename, 'filename')
      : tab.filename
    const markdown = hasOwn(replacement, 'markdown')
      ? requireString(replacement.markdown, 'markdown')
      : tab.markdown
    const dirty = hasOwn(replacement, 'dirty')
      ? requireBoolean(replacement.dirty, 'dirty')
      : false
    const exported = hasOwn(replacement, 'exported')
      ? requireBoolean(replacement.exported, 'exported')
      : true

    if (
      tab.filename === filename
      && tab.markdown === markdown
      && tab.dirty === dirty
      && tab.exported === exported
    ) return tab

    return { ...tab, filename, markdown, dirty, exported }
  })
}

export function markTabExported(workspace, tabId, options = {}) {
  assertOptions(options)
  return updateTab(workspace, tabId, (tab) => {
    const filename = hasOwn(options, 'filename')
      ? requireString(options.filename, 'filename')
      : tab.filename
    if (tab.filename === filename && !tab.dirty && tab.exported) return tab
    return { ...tab, filename, dirty: false, exported: true }
  })
}

/**
 * Informa a la interfaz de que cerrar o reemplazar requiere confirmación.
 * Un documento migrado puede no estar dirty pero seguir sin copia externa.
 */
export function needsDiscardConfirmation(tab) {
  if (!isObject(tab)) {
    throw workspaceError('INVALID_ARGUMENT', 'La pestaña no es válida.')
  }
  return tab.dirty === true || (tab.exported !== true && tab.markdown !== '')
}

/**
 * Cierra sin preguntar; la UI debe consultar needsDiscardConfirmation antes.
 * Al cerrar la última pestaña se crea otra vacía para mantener el editor usable.
 */
export function closeTab(workspace, tabId, options = {}) {
  assertOptions(options)
  const index = findTabIndex(workspace, tabId)
  const ensureOne = hasOwn(options, 'ensureOne')
    ? requireBoolean(options.ensureOne, 'ensureOne')
    : true
  const tabs = workspace.tabs.filter((tab) => tab.id !== tabId)

  let activeTabId = workspace.activeTabId
  if (workspace.activeTabId === tabId) {
    activeTabId = tabs[index]?.id ?? tabs[index - 1]?.id ?? null
  }

  const nextWorkspace = { ...workspace, activeTabId, tabs }
  if (tabs.length > 0 || !ensureOne) return nextWorkspace

  const replacement = isObject(options.replacement) ? options.replacement : {}
  return createTab(nextWorkspace, replacement)
}

/** Migra el objeto o JSON usado por linea-document-v1, preservando cadenas vacías. */
export function migrateLegacyDocument(legacyValue, options = {}) {
  assertOptions(options)
  let legacy = legacyValue

  if (typeof legacyValue === 'string') {
    try {
      legacy = JSON.parse(legacyValue)
    } catch (error) {
      throw workspaceError('INVALID_LEGACY_DOCUMENT', 'El documento v1 no contiene JSON válido.', error)
    }
  }

  if (!isObject(legacy)) {
    throw workspaceError('INVALID_LEGACY_DOCUMENT', 'El documento v1 no es válido.')
  }

  const filename = typeof legacy.filename === 'string'
    ? legacy.filename
    : typeof options.defaultFilename === 'string'
      ? options.defaultFilename
      : DEFAULT_DOCUMENT_FILENAME
  const markdown = typeof legacy.markdown === 'string'
    ? legacy.markdown
    : typeof options.defaultMarkdown === 'string'
      ? options.defaultMarkdown
      : ''

  return createWorkspace({ filename, markdown, dirty: false, exported: false })
}

/** Serializa sin lanzar excepciones y elimina propiedades desconocidas. */
export function serializeWorkspace(workspace) {
  try {
    const canonical = canonicalizeWorkspace(workspace)
    return { ok: true, value: JSON.stringify(canonical), error: null }
  } catch (error) {
    return errorResult(
      'SERIALIZATION_FAILED',
      'No se ha podido serializar el workspace.',
      error,
    )
  }
}

/** Deserializa sin lanzar excepciones; nunca sustituye cadenas vacías por defaults. */
export function deserializeWorkspace(serialized) {
  if (typeof serialized !== 'string') {
    return errorResult('DESERIALIZATION_FAILED', 'El workspace serializado debe ser texto.')
  }

  try {
    const workspace = canonicalizeWorkspace(JSON.parse(serialized))
    return { ok: true, workspace, error: null }
  } catch (error) {
    return errorResult(
      'DESERIALIZATION_FAILED',
      'No se ha podido leer el workspace guardado.',
      error,
    )
  }
}

/** Guarda en cualquier implementación compatible con localStorage. */
export function saveWorkspace(storage, workspace, key = WORKSPACE_STORAGE_KEY) {
  const serialized = serializeWorkspace(workspace)
  if (!serialized.ok) return serialized

  if (!storage || typeof storage.setItem !== 'function') {
    return errorResult('STORAGE_UNAVAILABLE', 'El almacenamiento local no está disponible.')
  }

  try {
    storage.setItem(key, serialized.value)
    return { ok: true, key, value: serialized.value, error: null }
  } catch (error) {
    return errorResult('STORAGE_WRITE_FAILED', 'No se ha podido guardar el workspace.', error)
  }
}

/**
 * Carga v2 y, si no existe o está corrupto, intenta migrar linea-document-v1.
 * Siempre devuelve un workspace utilizable y expone cualquier fallo en error/warnings.
 */
export function loadWorkspace(storage, options = {}) {
  assertOptions(options)
  const fallback = isObject(options.fallbackWorkspace)
    ? (() => {
        try {
          return canonicalizeWorkspace(options.fallbackWorkspace)
        } catch {
          return defaultWorkspace(options)
        }
      })()
    : defaultWorkspace(options)
  const key = typeof options.key === 'string' ? options.key : WORKSPACE_STORAGE_KEY
  const legacyKey = typeof options.legacyKey === 'string'
    ? options.legacyKey
    : LEGACY_DOCUMENT_STORAGE_KEY
  const warnings = []

  if (!storage || typeof storage.getItem !== 'function') {
    const error = workspaceError('STORAGE_UNAVAILABLE', 'El almacenamiento local no está disponible.')
    return {
      ok: false,
      source: 'default',
      migrated: false,
      workspace: fallback,
      error,
      warnings: [error],
    }
  }

  let serialized
  try {
    serialized = storage.getItem(key)
  } catch (cause) {
    const error = workspaceError('STORAGE_READ_FAILED', 'No se ha podido leer el workspace.', cause)
    return {
      ok: false,
      source: 'default',
      migrated: false,
      workspace: fallback,
      error,
      warnings: [error],
    }
  }

  if (serialized !== null && serialized !== undefined) {
    const parsed = deserializeWorkspace(serialized)
    if (parsed.ok) {
      return {
        ok: true,
        source: 'v2',
        migrated: false,
        workspace: parsed.workspace,
        error: null,
        warnings,
      }
    }
    warnings.push(parsed.error)
  }

  let legacySerialized
  try {
    legacySerialized = storage.getItem(legacyKey)
  } catch (cause) {
    const error = workspaceError('STORAGE_READ_FAILED', 'No se ha podido leer el documento v1.', cause)
    warnings.push(error)
    return {
      ok: false,
      source: 'default',
      migrated: false,
      workspace: fallback,
      error: warnings[0],
      warnings,
    }
  }

  if (legacySerialized !== null && legacySerialized !== undefined) {
    try {
      const workspace = migrateLegacyDocument(legacySerialized, options)
      return {
        ok: true,
        source: 'legacy',
        migrated: true,
        workspace,
        error: null,
        warnings,
      }
    } catch (error) {
      warnings.push(error instanceof WorkspaceError
        ? error
        : workspaceError('INVALID_LEGACY_DOCUMENT', 'No se ha podido migrar el documento v1.', error))
    }
  }

  return {
    ok: warnings.length === 0,
    source: 'default',
    migrated: false,
    workspace: fallback,
    error: warnings[0] ?? null,
    warnings,
  }
}

/** Carga y persiste automáticamente una migración v1 correcta como v2. */
export function restoreWorkspace(storage, options = {}) {
  const loaded = loadWorkspace(storage, options)
  if (!loaded.migrated) return { ...loaded, migrationSaved: false, saveError: null }

  const key = typeof options.key === 'string' ? options.key : WORKSPACE_STORAGE_KEY
  const saved = saveWorkspace(storage, loaded.workspace, key)
  return {
    ...loaded,
    ok: loaded.ok && saved.ok,
    migrationSaved: saved.ok,
    saveError: saved.ok ? null : saved.error,
    error: saved.ok ? loaded.error : saved.error,
    warnings: saved.ok ? loaded.warnings : [...loaded.warnings, saved.error],
  }
}
