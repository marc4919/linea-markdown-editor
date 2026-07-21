import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CommandPalette from './components/CommandPalette.jsx'
import { ConfirmDialog, ImportDialog, RenameDialog } from './components/Dialog.jsx'
import DocumentTabs from './components/DocumentTabs.jsx'
import DropOverlay from './components/DropOverlay.jsx'
import FormattingToolbar from './components/FormattingToolbar.jsx'
import QuickGuide from './components/QuickGuide.jsx'
import StatusBar from './components/StatusBar.jsx'
import TableBuilderDialog from './components/TableBuilderDialog.jsx'
import Toolbar from './components/Toolbar.jsx'
import Workspace from './components/Workspace.jsx'
import MermaidBuilderDialog from './components/MermaidBuilderDialog.jsx'
import { STARTER_MARKDOWN } from './data.js'
import {
  getFormattingState,
  removeLink,
  setHeading,
  setLink,
  toggleBold,
  toggleInlineCode,
  toggleItalic,
  toggleList,
  toggleQuote,
} from './lib/formatting.js'
import {
  insertCodeBlock,
  insertFootnote,
  insertHorizontalRule,
  insertImage,
  insertTask,
  toggleStrikethrough,
  toggleUnderline,
} from './lib/advancedFormatting.js'
import {
  getDefaultMermaidSpec,
  insertConfiguredMermaid,
  insertConfiguredTable,
} from './lib/advancedBuilders.js'
import { renderMarkdown } from './lib/markdown.js'
import { richMarkdownNotice } from './lib/richMarkdownCompatibility.js'
import {
  activateTab,
  closeTab,
  createTab,
  createWorkspace,
  editTab,
  getActiveTab,
  getTab,
  markTabExported,
  needsDiscardConfirmation,
  renameTab,
  replaceTab,
  restoreWorkspace,
  saveWorkspace,
} from './lib/workspace.js'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_HISTORY_ENTRIES = 100
const MAX_HISTORY_BYTES = 12 * 1024 * 1024
const HISTORY_GROUP_WINDOW = 650
const EMPTY_SELECTION = { start: 0, end: 0, direction: 'none' }

const estimatedTextBytes = (value) => value.length * 2

function trimHistoryStack(history, stackName, bytesName, removeFromStart) {
  const stack = history[stackName]
  while ((stack.length > MAX_HISTORY_ENTRIES || history[bytesName] > MAX_HISTORY_BYTES) && stack.length > 1) {
    const removed = removeFromStart ? stack.shift() : stack.pop()
    history[bytesName] -= estimatedTextBytes(removed)
  }
}

function ensureHistoryAccounting(history) {
  if (!history) return null
  if (!Number.isFinite(history.pastBytes)) history.pastBytes = history.past.reduce((total, value) => total + estimatedTextBytes(value), 0)
  if (!Number.isFinite(history.futureBytes)) history.futureBytes = history.future.reduce((total, value) => total + estimatedTextBytes(value), 0)
  if (!Number.isFinite(history.lastEditAt)) history.lastEditAt = 0
  history.lastChangeWasTyping = Boolean(history.lastChangeWasTyping)
  return history
}

function initialWorkspace() {
  const fallbackWorkspace = createWorkspace({
    filename: 'bienvenida.md',
    markdown: STARTER_MARKDOWN,
    dirty: false,
    exported: true,
  })
  return restoreWorkspace(window.localStorage, {
    fallbackWorkspace,
    defaultFilename: 'bienvenida.md',
    defaultMarkdown: STARTER_MARKDOWN,
  })
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
}

function markdownFilename(filename) {
  const trimmed = filename.trim() || 'documento.md'
  return /\.md$/i.test(trimmed) ? trimmed : `${trimmed}.md`
}

function escapeDocumentTitle(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

let exportDiagramSequence = 0

async function renderExportBody(markdown) {
  const container = window.document.createElement('div')
  container.innerHTML = renderMarkdown(markdown)
  const diagrams = [...container.querySelectorAll('pre > code.language-mermaid')]
  if (!diagrams.length) return container.innerHTML

  try {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' })
    for (const code of diagrams) {
      try {
        exportDiagramSequence += 1
        const { svg } = await mermaid.render(`linea-export-diagram-${exportDiagramSequence}`, code.textContent ?? '')
        const diagram = window.document.createElement('div')
        diagram.className = 'mermaid-export'
        diagram.innerHTML = svg
        code.parentElement?.replaceWith(diagram)
      } catch {
        // Preserve the source fence if one diagram is invalid.
      }
    }
  } catch {
    // Export remains usable as Markdown code when Mermaid cannot be loaded.
  }

  return container.innerHTML
}

async function readMarkdownFiles(fileList) {
  const files = [...fileList]
  if (!files.length) return { files: [], rejected: [] }
  const rejected = []
  const accepted = files.filter((file) => {
    const extensionIsValid = /\.(md|markdown|txt)$/i.test(file.name)
    const typeIsValid = !file.type || file.type === 'text/plain' || file.type === 'text/markdown'
    if (!extensionIsValid || !typeIsValid) {
      rejected.push(`${file.name}: formato no compatible`)
      return false
    }
    if (file.size > MAX_FILE_SIZE) {
      rejected.push(`${file.name}: supera 5 MB`)
      return false
    }
    return true
  })
  const loaded = await Promise.all(accepted.map(async (file) => {
    const content = await file.text()
    if (content.includes('\0')) throw new Error(`${file.name} parece ser un archivo binario.`)
    return { name: file.name, content }
  }))
  return { files: loaded, rejected }
}

export default function App() {
  const restoreRef = useRef(null)
  const [workspace, setWorkspace] = useState(() => {
    restoreRef.current = initialWorkspace()
    return restoreRef.current.workspace
  })
  const workspaceStateRef = useRef(workspace)
  workspaceStateRef.current = workspace
  const [saveState, setSaveState] = useState(() => restoreRef.current?.ok === false
    ? { kind: 'error', label: 'No se pudo recuperar' }
    : { kind: 'saved', label: 'Guardado en Línea' })
  const [mode, setMode] = useState('rich')
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [selection, setSelection] = useState(EMPTY_SELECTION)
  const [guideOpen, setGuideOpen] = useState(false)
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [confirmation, setConfirmation] = useState(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [linkEditor, setLinkEditor] = useState({ open: false, kind: 'link', initialLabel: '', initialUrl: 'https://', canRemove: false })
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [builder, setBuilder] = useState(null)
  const [richFormatState, setRichFormatState] = useState({})
  const [notice, setNotice] = useState('')
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const richEditorRef = useRef(null)
  const linkSelectionRef = useRef(EMPTY_SELECTION)
  const renameTabIdRef = useRef(null)
  const dragDepthRef = useRef(0)
  const selectionsRef = useRef(new Map())
  const historyRef = useRef(new Map())

  const activeTab = getActiveTab(workspace)
  const activeId = activeTab.id

  const changeMode = useCallback((nextMode) => {
    if (nextMode === 'rich') {
      const protectionNotice = richMarkdownNotice(activeTab.markdown)
      if (protectionNotice) {
        setMode('source')
        setNotice(protectionNotice)
        setAdvancedOpen(false)
        setLinkEditor((current) => current.open ? { ...current, open: false } : current)
        setBuilder(null)
        return
      }
    }
    setMode(nextMode)
    setAdvancedOpen(false)
    setLinkEditor((current) => current.open ? { ...current, open: false } : current)
    setBuilder(null)
  }, [activeTab.markdown])

  useEffect(() => {
    if (mode !== 'rich') return
    const protectionNotice = richMarkdownNotice(activeTab.markdown)
    if (!protectionNotice) return
    setMode('source')
    setNotice(protectionNotice)
  }, [activeId, activeTab.markdown, mode])

  useEffect(() => {
    setSaveState({ kind: 'saving', label: 'Guardando…' })
    const timer = window.setTimeout(() => {
      const result = saveWorkspace(window.localStorage, workspace)
      setSaveState(result.ok
        ? { kind: 'saved', label: 'Guardado en Línea' }
        : { kind: 'error', label: 'No se pudo guardar' })
    }, 220)
    return () => window.clearTimeout(timer)
  }, [workspace])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 4200)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    setLinkEditor((current) => current.open ? { ...current, open: false } : current)
    setAdvancedOpen(false)
    setBuilder(null)
    if (renameTabIdRef.current && renameTabIdRef.current !== activeId) setRenameOpen(false)
    setConfirmation((current) => current?.type === 'replace' && current.tabId !== activeId ? null : current)
  }, [activeId])

  const restoreEditorSelection = useCallback((nextSelection, focus = true) => {
    setSelection(nextSelection)
    selectionsRef.current.set(activeId, nextSelection)
    window.setTimeout(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      if (focus) textarea.focus()
      textarea.setSelectionRange(nextSelection.start, nextSelection.end, nextSelection.direction || 'none')
    }, 0)
  }, [activeId])

  const recordHistory = useCallback((tabId, previousMarkdown, nextMarkdown) => {
    const history = ensureHistoryAccounting(historyRef.current.get(tabId)) || {
      past: [],
      future: [],
      pastBytes: 0,
      futureBytes: 0,
      lastEditAt: 0,
      lastChangeWasTyping: false,
    }
    const now = Date.now()
    const typingLikeChange = Math.abs(nextMarkdown.length - previousMarkdown.length) <= 2
    const shouldGroup = typingLikeChange
      && history.lastChangeWasTyping
      && now - history.lastEditAt < HISTORY_GROUP_WINDOW
    if (!shouldGroup && history.past.at(-1) !== previousMarkdown) {
      history.past.push(previousMarkdown)
      history.pastBytes += estimatedTextBytes(previousMarkdown)
      trimHistoryStack(history, 'past', 'pastBytes', true)
    }
    history.future = []
    history.futureBytes = 0
    history.lastEditAt = now
    history.lastChangeWasTyping = typingLikeChange
    historyRef.current.set(tabId, history)
  }, [])

  const updateMarkdown = useCallback((markdown, { record = true } = {}) => {
    if (markdown === activeTab.markdown) return
    if (record) recordHistory(activeId, activeTab.markdown, markdown)
    setWorkspace(editTab(workspace, activeId, markdown))
  }, [activeId, activeTab.markdown, recordHistory, workspace])

  const activateDocument = useCallback((tabId) => {
    selectionsRef.current.set(activeId, selection)
    const nextSelection = selectionsRef.current.get(tabId) || EMPTY_SELECTION
    setWorkspace((current) => activateTab(current, tabId))
    setSelection(nextSelection)
    setCursor({ line: 1, column: 1 })
    window.setTimeout(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.setSelectionRange(nextSelection.start, nextSelection.end, nextSelection.direction || 'none')
    }, 0)
  }, [activeId, selection])

  const createDocument = useCallback(() => {
    selectionsRef.current.set(activeId, selection)
    setWorkspace((current) => createTab(current))
    setSelection(EMPTY_SELECTION)
    setMode((current) => current === 'preview' ? 'rich' : current)
    window.setTimeout(() => (richEditorRef.current || textareaRef.current)?.focus?.(), 0)
  }, [activeId, selection])

  const performClose = useCallback((tabId) => {
    const closingActiveTab = tabId === activeId
    const nextWorkspace = closeTab(workspace, tabId)
    const nextSelection = closingActiveTab
      ? (selectionsRef.current.get(nextWorkspace.activeTabId) || EMPTY_SELECTION)
      : selection
    selectionsRef.current.delete(tabId)
    historyRef.current.delete(tabId)
    setWorkspace(nextWorkspace)
    if (!closingActiveTab) return
    setSelection(nextSelection)
    setCursor({ line: 1, column: 1 })
    window.setTimeout(() => {
      const editor = textareaRef.current
      if (!editor) return
      editor.setSelectionRange(nextSelection.start, nextSelection.end, nextSelection.direction || 'none')
    }, 0)
  }, [activeId, selection, workspace])

  const requestClose = useCallback((tabId) => {
    const tab = getTab(workspace, tabId)
    if (needsDiscardConfirmation(tab)) {
      setConfirmation({
        type: 'close',
        tabId,
        title: `Cerrar «${tab.filename}»`,
        message: 'Esta pestaña contiene cambios que todavía no se han exportado a un archivo.',
        confirmLabel: 'Cerrar de todos modos',
      })
      return
    }
    performClose(tabId)
  }, [performClose, workspace])

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), [])

  const prepareFiles = useCallback(async (files) => {
    try {
      const result = await readMarkdownFiles(files)
      if (result.rejected.length) setNotice(result.rejected.join(' · '))
      if (result.files.length) setPendingFiles(result.files)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se ha podido leer el archivo.')
    }
  }, [])

  const handleFileInput = useCallback(async (event) => {
    await prepareFiles(event.target.files || [])
    event.target.value = ''
  }, [prepareFiles])

  const importInNewTabs = useCallback(() => {
    selectionsRef.current.set(activeId, selection)
    let next = workspace
    for (const file of pendingFiles) {
      next = createTab(next, { filename: file.name, markdown: file.content, dirty: false, exported: true })
    }
    setWorkspace(next)
    setPendingFiles([])
    setSelection(EMPTY_SELECTION)
    setMode((current) => current === 'preview' ? 'source' : current)
  }, [activeId, pendingFiles, selection, workspace])

  const performReplace = useCallback((tabId = activeId) => {
    const file = pendingFiles[0]
    if (!file) return
    setWorkspace((current) => current.tabs.some((tab) => tab.id === tabId)
      ? replaceTab(current, tabId, {
        filename: file.name,
        markdown: file.content,
        dirty: false,
        exported: true,
      })
      : current)
    historyRef.current.delete(tabId)
    setPendingFiles([])
    setConfirmation(null)
    if (tabId === activeId) {
      setSelection(EMPTY_SELECTION)
      restoreEditorSelection(EMPTY_SELECTION)
    }
  }, [activeId, pendingFiles, restoreEditorSelection])

  const requestReplace = useCallback(() => {
    if (needsDiscardConfirmation(activeTab)) {
      setConfirmation({
        type: 'replace',
        tabId: activeId,
        title: `Reemplazar «${activeTab.filename}»`,
        message: 'Esta pestaña contiene cambios sin exportar. El archivo nuevo ocupará su lugar.',
        confirmLabel: 'Reemplazar sin exportar',
      })
      return
    }
    performReplace()
  }, [activeId, activeTab, performReplace])

  const confirmAction = useCallback(() => {
    if (confirmation?.type === 'close') performClose(confirmation.tabId)
    if (confirmation?.type === 'replace') performReplace(confirmation.tabId)
    setConfirmation(null)
  }, [confirmation, performClose, performReplace])

  const exportMarkdown = useCallback(() => {
    const filename = markdownFilename(activeTab.filename)
    downloadBlob(activeTab.markdown, 'text/markdown;charset=utf-8', filename)
    setWorkspace((current) => markTabExported(current, current.activeTabId, { filename }))
    setNotice(`Exportado como ${filename}`)
  }, [activeTab])

  const exportHtml = useCallback(async () => {
    const tabId = activeId
    const markdownSnapshot = activeTab.markdown
    const filenameSnapshot = activeTab.filename
    const filename = markdownFilename(activeTab.filename).replace(/\.md$/i, '.html')
    const title = escapeDocumentTitle(activeTab.filename.replace(/\.md$/i, '') || 'Documento')
    setNotice('Preparando la página web…')
    const body = await renderExportBody(markdownSnapshot)
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{max-width:760px;margin:64px auto;padding:0 24px;color:#211f1c;font:19px/1.6 Georgia,serif}h1{font-size:48px;line-height:1.05}h2{font-size:32px}pre{overflow:auto;padding:18px;background:#292723;color:#fff}code{font-family:monospace}blockquote{border-left:3px solid #c92e28;padding-left:18px;color:#666}img{max-width:100%;height:auto}table{width:100%;margin:24px 0;border-collapse:collapse;font:16px/1.45 system-ui,sans-serif}th,td{padding:10px 12px;border:1px solid #d9d6cf;text-align:left}th{background:#f7f6f2}.task-list-item{list-style:none}.task-list-item input{accent-color:#c92e28}.footnotes{margin-top:44px;border-top:1px solid #d9d6cf;font-size:15px}.mermaid-export{display:grid;place-items:center;max-width:100%;overflow:auto;margin:28px 0}.mermaid-export svg{max-width:100%;height:auto}hr{border:0;border-top:1px solid #d9d6cf}</style></head><body>${body}</body></html>`
    downloadBlob(html, 'text/html;charset=utf-8', filename)
    const latestTab = workspaceStateRef.current.tabs.find((tab) => tab.id === tabId)
    const snapshotIsCurrent = latestTab?.markdown === markdownSnapshot && latestTab?.filename === filenameSnapshot
    setWorkspace((current) => {
      const currentTab = current.tabs.find((tab) => tab.id === tabId)
      return currentTab?.markdown === markdownSnapshot && currentTab?.filename === filenameSnapshot
        ? markTabExported(current, tabId)
        : current
    })
    setNotice(snapshotIsCurrent
      ? `Exportado como ${filename}`
      : `Se exportó una instantánea como ${filename}; los cambios posteriores siguen pendientes.`)
  }, [activeId, activeTab.filename, activeTab.markdown])

  const openRename = useCallback(() => {
    renameTabIdRef.current = activeId
    setRenameValue(activeTab.filename)
    setRenameOpen(true)
  }, [activeId, activeTab.filename])

  const confirmRename = useCallback(() => {
    const filename = markdownFilename(renameValue)
    const tabId = renameTabIdRef.current
    setWorkspace((current) => current.tabs.some((tab) => tab.id === tabId)
      ? renameTab(current, tabId, filename)
      : current)
    setRenameOpen(false)
  }, [renameValue])

  const applyResult = useCallback((result) => {
    updateMarkdown(result.text)
    restoreEditorSelection({ start: result.selectionStart, end: result.selectionEnd, direction: 'none' })
  }, [restoreEditorSelection, updateMarkdown])

  const openLinkEditor = useCallback((kind = 'link') => {
    setAdvancedOpen(false)

    const openForRichEditor = () => {
      const currentState = richEditorRef.current?.getLinkState?.() || { label: '', url: '', active: false }
      linkSelectionRef.current = { editorKind: 'rich', tabId: activeId }
      setLinkEditor({
        open: true,
        kind,
        initialLabel: currentState.label || '',
        initialUrl: kind === 'image' ? 'https://' : (currentState.url || 'https://'),
        canRemove: kind === 'link' && currentState.active,
      })
    }

    if (mode === 'rich') {
      openForRichEditor()
      return
    }
    if (mode === 'preview') {
      const protectionNotice = richMarkdownNotice(activeTab.markdown)
      if (protectionNotice) {
        setMode('source')
        setNotice(protectionNotice)
        return
      }
      setMode('rich')
      window.setTimeout(openForRichEditor, 0)
      return
    }

    const preservedSelection = { ...selection }
    const currentState = getFormattingState(activeTab.markdown, preservedSelection.start, preservedSelection.end)
    const selectedText = activeTab.markdown.slice(preservedSelection.start, preservedSelection.end)
    linkSelectionRef.current = { ...preservedSelection, editorKind: 'source', tabId: activeId, markdownSnapshot: activeTab.markdown }
    setLinkEditor({
      open: true,
      kind,
      initialLabel: kind === 'image' ? selectedText : (currentState.linkData?.label ?? selectedText),
      initialUrl: kind === 'image' ? 'https://' : (currentState.linkData?.url ?? 'https://'),
      canRemove: kind === 'link' && Boolean(currentState.linkData),
    })
  }, [activeId, activeTab.markdown, mode, selection])

  const closeLinkEditor = useCallback(() => {
    setLinkEditor((current) => ({ ...current, open: false }))
    if (linkSelectionRef.current.editorKind === 'rich' && linkSelectionRef.current.tabId === activeId) {
      window.setTimeout(() => richEditorRef.current?.focus?.(), 0)
      return
    }
    if (linkSelectionRef.current.tabId === activeId && linkSelectionRef.current.markdownSnapshot === activeTab.markdown) {
      const { start, end, direction = 'none' } = linkSelectionRef.current
      restoreEditorSelection({ start, end, direction })
    }
  }, [activeId, activeTab.markdown, restoreEditorSelection])

  const submitLinkEditor = useCallback(({ label, url }) => {
    const { start, end, tabId, markdownSnapshot, editorKind } = linkSelectionRef.current
    if (editorKind === 'rich') {
      if (tabId !== activeId || mode !== 'rich') {
        setLinkEditor((current) => ({ ...current, open: false }))
        setNotice('El documento cambió. Vuelve a abrir la herramienta de enlace.')
        return
      }
      if (linkEditor.kind === 'image') richEditorRef.current?.insertImage?.({ alt: label, url })
      else richEditorRef.current?.setLink?.({ label, url })
      setLinkEditor((current) => ({ ...current, open: false }))
      return
    }
    if (tabId !== activeId || markdownSnapshot !== activeTab.markdown) {
      setLinkEditor((current) => ({ ...current, open: false }))
      setNotice('El texto cambió. Selecciónalo de nuevo para añadir el enlace.')
      return
    }
    const result = linkEditor.kind === 'image'
      ? insertImage(activeTab.markdown, start, end, { alt: label, url })
      : setLink(activeTab.markdown, start, end, { label, url })
    setLinkEditor((current) => ({ ...current, open: false }))
    applyResult(result)
  }, [activeId, activeTab.markdown, applyResult, linkEditor.kind, mode])

  const removeCurrentLink = useCallback(() => {
    const { start, end, tabId, markdownSnapshot, editorKind } = linkSelectionRef.current
    if (editorKind === 'rich') {
      if (tabId === activeId && mode === 'rich') richEditorRef.current?.unsetLink?.()
      setLinkEditor((current) => ({ ...current, open: false }))
      return
    }
    if (tabId !== activeId || markdownSnapshot !== activeTab.markdown) {
      setLinkEditor((current) => ({ ...current, open: false }))
      setNotice('El texto cambió. Selecciona de nuevo el enlace que quieres quitar.')
      return
    }
    setLinkEditor((current) => ({ ...current, open: false }))
    applyResult(removeLink(activeTab.markdown, start, end))
  }, [activeId, activeTab.markdown, applyResult, mode])

  const applyFormat = useCallback((format) => {
    if (mode === 'rich') {
      richEditorRef.current?.format?.(format)
      return
    }
    if (mode === 'preview') {
      const protectionNotice = richMarkdownNotice(activeTab.markdown)
      if (protectionNotice) {
        setMode('source')
        setNotice(protectionNotice)
        return
      }
      setMode('rich')
      window.setTimeout(() => richEditorRef.current?.format?.(format), 0)
      return
    }
    const functions = {
      bold: toggleBold,
      italic: toggleItalic,
      list: toggleList,
      quote: toggleQuote,
      code: toggleInlineCode,
    }
    const transform = functions[format]
    if (!transform) return
    applyResult(transform(activeTab.markdown, selection.start, selection.end))
  }, [activeTab.markdown, applyResult, mode, selection.end, selection.start])

  const applyHeading = useCallback((level) => {
    if (mode === 'rich') {
      richEditorRef.current?.setHeading?.(level)
      return
    }
    if (mode === 'preview') {
      const protectionNotice = richMarkdownNotice(activeTab.markdown)
      if (protectionNotice) {
        setMode('source')
        setNotice(protectionNotice)
        return
      }
      setMode('rich')
      window.setTimeout(() => richEditorRef.current?.setHeading?.(level), 0)
      return
    }
    applyResult(setHeading(activeTab.markdown, selection.start, selection.end, level))
  }, [activeTab.markdown, applyResult, mode, selection.end, selection.start])

  const applyAdvancedAction = useCallback((action) => {
    setAdvancedOpen(false)
    if (action === 'image') {
      openLinkEditor('image')
      return
    }
    if (mode === 'rich') {
      if (action === 'table') {
        setBuilder({ kind: 'table', spec: { columns: 3, bodyRows: 2, headers: ['Columna 1', 'Columna 2', 'Columna 3'] }, tabId: activeId, editorKind: 'rich' })
        return
      }
      if (action === 'mermaid') {
        setBuilder({ kind: 'mermaid', spec: getDefaultMermaidSpec('flowchart'), source: '', tabId: activeId, editorKind: 'rich', position: null })
        return
      }
      if (action === 'footnote') {
        const identifiers = [...activeTab.markdown.matchAll(/\[\^(\d+)\]/g)].map((match) => Number(match[1]))
        const identifier = Math.max(0, ...identifiers) + 1
        richEditorRef.current?.insertMarkdown?.(`[^${identifier}]\n\n[^${identifier}]: Nota al pie`)
        return
      }
      richEditorRef.current?.format?.(action)
      return
    }
    if (action === 'table') {
      setBuilder({
        kind: 'table',
        spec: { columns: 3, bodyRows: 2, headers: ['Columna 1', 'Columna 2', 'Columna 3'] },
        tabId: activeId,
        editorKind: 'source',
        markdownSnapshot: activeTab.markdown,
        selection: { ...selection },
      })
      return
    }
    if (action === 'mermaid') {
      setBuilder({
        kind: 'mermaid',
        spec: getDefaultMermaidSpec('flowchart'),
        source: '',
        tabId: activeId,
        editorKind: 'source',
        markdownSnapshot: activeTab.markdown,
        selection: { ...selection },
        position: null,
      })
      return
    }
    const transforms = {
      underline: toggleUnderline,
      strike: toggleStrikethrough,
      task: insertTask,
      codeblock: insertCodeBlock,
      rule: insertHorizontalRule,
      footnote: insertFootnote,
    }
    const transform = transforms[action]
    if (!transform) return
    if (mode === 'preview') setMode('source')
    applyResult(transform(activeTab.markdown, selection.start, selection.end))
  }, [activeId, activeTab.markdown, applyResult, mode, openLinkEditor, selection])

  const updateBuilderSpec = useCallback((spec) => {
    setBuilder((current) => current ? { ...current, spec } : current)
  }, [])

  const updateBuilderSource = useCallback((source) => {
    setBuilder((current) => current ? { ...current, source } : current)
  }, [])

  const confirmTableBuilder = useCallback((spec, generatedMarkdown) => {
    if (!builder || builder.kind !== 'table' || builder.tabId !== activeId) {
      setBuilder(null)
      setNotice('El documento cambió. Abre de nuevo el creador de tablas.')
      return
    }
    if (builder.editorKind === 'rich') {
      richEditorRef.current?.insertMarkdown?.(generatedMarkdown)
      setBuilder(null)
      return
    }
    if (builder.markdownSnapshot !== activeTab.markdown) {
      setBuilder(null)
      setNotice('El texto cambió. Abre de nuevo el creador de tablas.')
      return
    }
    const { start, end } = builder.selection
    setBuilder(null)
    applyResult(insertConfiguredTable(activeTab.markdown, start, end, spec))
  }, [activeId, activeTab.markdown, applyResult, builder])

  const confirmMermaidBuilder = useCallback((spec, source) => {
    if (!builder || builder.kind !== 'mermaid' || builder.tabId !== activeId) {
      setBuilder(null)
      setNotice('El documento cambió. Abre de nuevo el creador de diagramas.')
      return
    }
    if (builder.editorKind === 'rich') {
      richEditorRef.current?.setMermaid?.(source, builder.position)
      setBuilder(null)
      return
    }
    if (builder.markdownSnapshot !== activeTab.markdown) {
      setBuilder(null)
      setNotice('El texto cambió. Abre de nuevo el creador de diagramas.')
      return
    }
    const { start, end } = builder.selection
    setBuilder(null)
    applyResult(insertConfiguredMermaid(activeTab.markdown, start, end, source))
  }, [activeId, activeTab.markdown, applyResult, builder])

  const editRichMermaid = useCallback(({ position, source }) => {
    setAdvancedOpen(false)
    setLinkEditor((current) => current.open ? { ...current, open: false } : current)
    setBuilder({
      kind: 'mermaid',
      spec: getDefaultMermaidSpec('flowchart'),
      source: String(source ?? ''),
      tabId: activeId,
      editorKind: 'rich',
      position,
    })
  }, [activeId])

  const undoSource = useCallback(() => {
    const history = ensureHistoryAccounting(historyRef.current.get(activeId))
    const previous = history?.past.pop()
    if (previous === undefined) return
    history.pastBytes = Math.max(0, history.pastBytes - estimatedTextBytes(previous))
    history.future.unshift(activeTab.markdown)
    history.futureBytes += estimatedTextBytes(activeTab.markdown)
    trimHistoryStack(history, 'future', 'futureBytes', false)
    history.lastEditAt = 0
    history.lastChangeWasTyping = false
    setWorkspace(editTab(workspace, activeId, previous))
  }, [activeId, activeTab.markdown, workspace])

  const redoSource = useCallback(() => {
    const history = ensureHistoryAccounting(historyRef.current.get(activeId))
    const next = history?.future.shift()
    if (next === undefined) return
    history.futureBytes = Math.max(0, history.futureBytes - estimatedTextBytes(next))
    history.past.push(activeTab.markdown)
    history.pastBytes += estimatedTextBytes(activeTab.markdown)
    trimHistoryStack(history, 'past', 'pastBytes', true)
    history.lastEditAt = 0
    history.lastChangeWasTyping = false
    setWorkspace(editTab(workspace, activeId, next))
  }, [activeId, activeTab.markdown, workspace])

  const undo = useCallback(() => {
    if (mode === 'rich') {
      richEditorRef.current?.undo?.()
      return
    }
    undoSource()
  }, [mode, undoSource])

  const redo = useCallback(() => {
    if (mode === 'rich') {
      richEditorRef.current?.redo?.()
      return
    }
    redoSource()
  }, [mode, redoSource])

  const updateCursor = useCallback((textarea) => {
    const beforeCursor = textarea.value.slice(0, textarea.selectionStart)
    const lines = beforeCursor.split('\n')
    setCursor({ line: lines.length, column: lines.at(-1).length + 1 })
  }, [])

  const updateSelection = useCallback((nextSelection) => {
    setSelection(nextSelection)
    selectionsRef.current.set(activeId, nextSelection)
  }, [activeId])

  const handleEditorKeyDown = useCallback((event) => {
    if (event.isComposing) return
    const command = event.metaKey || event.ctrlKey
    if (!command) return
    const key = event.key.toLowerCase()
    if (key === 'k' && !event.shiftKey) {
      event.preventDefault()
      openLinkEditor('link')
      return
    }
    if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
      return
    }
    if (key === 'y') {
      event.preventDefault()
      redo()
      return
    }
    if (key === '/') {
      event.preventDefault()
      setGuideOpen(true)
      return
    }
    if (key === 'b' || key === 'i') {
      event.preventDefault()
      applyFormat(key === 'b' ? 'bold' : 'italic')
    }
    if (event.altKey && /^[1-6]$/.test(event.key)) {
      event.preventDefault()
      applyHeading(Number(event.key))
    }
  }, [applyFormat, applyHeading, openLinkEditor, redo, undo])

  const navigateToLine = useCallback((line) => {
    const targetLine = Math.max(1, line)
    const lines = activeTab.markdown.split('\n')
    const start = lines.slice(0, targetLine - 1).reduce((total, value) => total + value.length + 1, 0)
    if (mode !== 'source' && mode !== 'split') setMode('source')
    const nextSelection = { start, end: start, direction: 'none' }
    restoreEditorSelection(nextSelection)
    window.setTimeout(() => textareaRef.current?.scrollToLine?.(targetLine), 0)
  }, [activeTab.markdown, mode, restoreEditorSelection])

  const toggleFocusMode = useCallback(() => {
    if (!focusMode) {
      const protectionNotice = richMarkdownNotice(activeTab.markdown)
      if (protectionNotice) {
        setMode('source')
        setNotice(protectionNotice)
        return
      }
      setMode('rich')
      setFocusMode(true)
      return
    }
    setFocusMode(false)
  }, [activeTab.markdown, focusMode])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented) return
      const command = event.metaKey || event.ctrlKey
      const targetIsInput = event.target instanceof Element && Boolean(event.target.closest('input, textarea, select, [contenteditable="true"]'))
      const editorHasFocus = Boolean(
        richEditorRef.current?.hasFocus?.()
        || textareaRef.current?.hasFocus?.()
        || document.activeElement === textareaRef.current,
      )
      if (event.key === 'Escape') {
        setCommandOpen(false)
        setConfirmation(null)
        setPendingFiles([])
        setRenameOpen(false)
        setLinkEditor((current) => ({ ...current, open: false }))
        setAdvancedOpen(false)
        setBuilder(null)
        setGuideOpen(false)
        setDropActive(false)
        return
      }
      const dialogOpen = Boolean(confirmation || pendingFiles.length || renameOpen || linkEditor.open || guideOpen || commandOpen || builder)
      if (dialogOpen) return
      if (event.key === 'F2' && !command) {
        if (targetIsInput) return
        event.preventDefault()
        openRename()
        return
      }
      if (!command) return
      const key = event.key.toLowerCase()
      if (targetIsInput && !editorHasFocus) return
      if (key === 'p' && event.shiftKey) { event.preventDefault(); setCommandOpen(true) }
      if (key === 'k' && !event.shiftKey && (!targetIsInput || editorHasFocus)) { event.preventDefault(); openLinkEditor('link') }
      if (key === 't' && !event.shiftKey) { event.preventDefault(); createDocument() }
      if (key === 'o' && !event.shiftKey) {
        event.preventDefault()
        openFilePicker()
      }
      if (key === 'w' && !event.shiftKey) { event.preventDefault(); requestClose(activeId) }
      if (key === 's' && !event.shiftKey) { event.preventDefault(); exportMarkdown() }
      if (key === 'l' && event.shiftKey) { event.preventDefault(); changeMode('rich') }
      if (key === 'e' && event.shiftKey) { event.preventDefault(); changeMode('source') }
      if (key === 'd' && event.shiftKey) { event.preventDefault(); changeMode('split') }
      if (key === 'p' && event.altKey) { event.preventDefault(); changeMode('preview') }
      if (key === 'o' && event.shiftKey) { event.preventDefault(); setOutlineCollapsed((current) => !current) }
      if (key === 'f' && event.shiftKey) { event.preventDefault(); toggleFocusMode() }
      if (key === '/') { event.preventDefault(); setGuideOpen(true) }
      if (key === 'z' && event.shiftKey && editorHasFocus) { event.preventDefault(); redo() }
      else if (key === 'z' && editorHasFocus) { event.preventDefault(); undo() }
      if (/^[1-9]$/.test(event.key) && !event.altKey) {
        const tab = workspace.tabs[Number(event.key) - 1]
        if (tab) { event.preventDefault(); activateDocument(tab.id) }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activateDocument, activeId, builder, changeMode, commandOpen, confirmation, createDocument, exportMarkdown, guideOpen, linkEditor.open, openFilePicker, openLinkEditor, openRename, pendingFiles.length, redo, renameOpen, requestClose, toggleFocusMode, undo, workspace.tabs])

  const sourceFormatState = useMemo(() => {
    const state = getFormattingState(activeTab.markdown, selection.start, selection.end)
    return { ...state, headingLevel: state.heading }
  }, [activeTab.markdown, selection.end, selection.start])

  const formatState = mode === 'rich' ? richFormatState : sourceFormatState

  const restoreActiveEditorFocus = useCallback(() => {
    window.setTimeout(() => {
      if (mode === 'rich') richEditorRef.current?.focus?.()
      else textareaRef.current?.focus?.()
    }, 0)
  }, [mode])

  const wordCount = useMemo(() => {
    const plainText = activeTab.markdown.replace(/[#>*_`\-[\]()~]/g, ' ').trim()
    return plainText ? plainText.split(/\s+/).length : 0
  }, [activeTab.markdown])

  const commands = [
    { id: 'new', label: 'Nuevo documento', shortcut: '⌘T', keywords: 'crear archivo', action: createDocument },
    { id: 'open', label: 'Abrir archivos', shortcut: '⌘O', keywords: 'importar cargar', action: openFilePicker },
    { id: 'rename', label: 'Renombrar documento', shortcut: 'F2', keywords: 'nombre título', action: openRename },
    { id: 'export', label: 'Exportar Markdown', shortcut: '⌘S', keywords: 'guardar descargar', action: exportMarkdown },
    { id: 'export-html', label: 'Exportar página web', keywords: 'html descargar', action: exportHtml },
    { id: 'bold', label: 'Aplicar negrita', shortcut: '⌘B', keywords: 'formato fuerte', action: () => applyFormat('bold') },
    { id: 'italic', label: 'Aplicar cursiva', shortcut: '⌘I', keywords: 'formato énfasis', action: () => applyFormat('italic') },
    { id: 'link', label: 'Añadir o editar enlace', shortcut: '⌘K', keywords: 'url vínculo', action: () => openLinkEditor('link') },
    { id: 'table', label: 'Insertar tabla', keywords: 'markdown avanzado columnas', action: () => applyAdvancedAction('table') },
    { id: 'task', label: 'Insertar lista de tareas', keywords: 'checkbox avanzado', action: () => applyAdvancedAction('task') },
    { id: 'image', label: 'Insertar imagen por URL', keywords: 'foto avanzado', action: () => applyAdvancedAction('image') },
    { id: 'footnote', label: 'Insertar nota al pie', keywords: 'referencia avanzado', action: () => applyAdvancedAction('footnote') },
    { id: 'mermaid', label: 'Insertar diagrama Mermaid', keywords: 'gráfico flujo avanzado', action: () => applyAdvancedAction('mermaid') },
    { id: 'codeblock', label: 'Insertar bloque de código', keywords: 'fence avanzado', action: () => applyAdvancedAction('codeblock') },
    { id: 'outline', label: outlineCollapsed ? 'Mostrar estructura' : 'Ocultar estructura', shortcut: '⌘⇧O', action: () => setOutlineCollapsed((current) => !current) },
    { id: 'rich', label: 'Cambiar a edición enriquecida', shortcut: '⌘⇧L', keywords: 'wysiwyg documento word', action: () => changeMode('rich') },
    { id: 'source', label: 'Cambiar a Markdown', shortcut: '⌘⇧E', keywords: 'fuente código crudo', action: () => changeMode('source') },
    { id: 'split', label: 'Comparar Markdown y lectura', shortcut: '⌘⇧D', action: () => changeMode('split') },
    { id: 'preview', label: 'Cambiar a lectura', shortcut: '⌘⌥P', action: () => changeMode('preview') },
    { id: 'focus', label: focusMode ? 'Salir del modo concentración' : 'Entrar en modo concentración', shortcut: '⌘⇧F', action: toggleFocusMode },
    { id: 'guide', label: 'Abrir guía rápida', shortcut: '⌘/', action: () => setGuideOpen(true) },
  ]

  const handleDragEnter = (event) => {
    if (!event.dataTransfer?.types?.includes('Files')) return
    event.preventDefault()
    dragDepthRef.current += 1
    setDropActive(true)
  }
  const handleDragLeave = (event) => {
    if (!event.dataTransfer?.types?.includes('Files')) return
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setDropActive(false)
  }
  const handleDragOver = (event) => {
    if (event.dataTransfer?.types?.includes('Files')) event.preventDefault()
  }
  const handleDrop = (event) => {
    if (!event.dataTransfer?.files?.length) return
    event.preventDefault()
    dragDepthRef.current = 0
    setDropActive(false)
    prepareFiles(event.dataTransfer.files)
  }

  return (
    <div
      className={`app-shell${focusMode ? ' is-focus-mode' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Toolbar
        filename={activeTab.filename}
        mode={mode}
        saveState={saveState}
        onModeChange={changeMode}
        onNew={createDocument}
        onOpen={openFilePicker}
        onDownload={exportMarkdown}
        onExportHtml={exportHtml}
        onCommand={() => setCommandOpen(true)}
        onRename={openRename}
      />
      <DocumentTabs documents={workspace.tabs} activeId={activeId} onActivate={activateDocument} onClose={requestClose} onNew={createDocument} onRename={openRename} />
      <FormattingToolbar
        onFormat={applyFormat}
        onHeading={applyHeading}
        formatState={formatState}
        disabled={mode === 'preview'}
        onUndo={undo}
        onRedo={redo}
        guideOpen={guideOpen}
        onToggleGuide={() => setGuideOpen((current) => !current)}
        onRequestLink={() => openLinkEditor('link')}
        linkEditor={{
          ...linkEditor,
          onSubmit: submitLinkEditor,
          onRemove: removeCurrentLink,
          onClose: closeLinkEditor,
        }}
        onAdvancedAction={applyAdvancedAction}
        advancedOpen={advancedOpen}
        onAdvancedOpenChange={(open) => {
          setAdvancedOpen(open)
          if (open) setLinkEditor((current) => current.open ? { ...current, open: false } : current)
        }}
      />
      <input ref={fileInputRef} hidden tabIndex="-1" aria-hidden="true" type="file" multiple accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={handleFileInput} />
      <Workspace
        documentId={activeId}
        markdown={activeTab.markdown}
        mode={mode}
        onModeChange={changeMode}
        onMarkdownChange={updateMarkdown}
        onCursorChange={updateCursor}
        onSelectionChange={updateSelection}
        onEditorKeyDown={handleEditorKeyDown}
        onUndo={undo}
        onRedo={redo}
        textareaRef={textareaRef}
        richEditorRef={richEditorRef}
        onRichFormatStateChange={setRichFormatState}
        onEditMermaid={editRichMermaid}
        outlineCollapsed={outlineCollapsed}
        onToggleOutline={() => setOutlineCollapsed((current) => !current)}
        onNavigate={navigateToLine}
      />
      <StatusBar words={wordCount} cursor={cursor} mode={mode} dirty={activeTab.dirty} saveState={saveState} />
      <QuickGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
      <DropOverlay visible={dropActive} />
      {focusMode ? (
        <button className="focus-exit-button" type="button" onClick={() => setFocusMode(false)}>
          <span aria-hidden="true">×</span>
          Salir de concentración
        </button>
      ) : null}
      {!confirmation ? <ImportDialog files={pendingFiles} dirty={needsDiscardConfirmation(activeTab)} onNewTabs={importInNewTabs} onReplace={requestReplace} onCancel={() => setPendingFiles([])} /> : null}
      {confirmation ? (
        <ConfirmDialog
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          destructive
          onConfirm={confirmAction}
          onCancel={() => setConfirmation(null)}
        />
      ) : null}
      {renameOpen ? <RenameDialog value={renameValue} onChange={setRenameValue} onConfirm={confirmRename} onCancel={() => setRenameOpen(false)} /> : null}
      {builder?.kind === 'table' ? (
        <TableBuilderDialog
          spec={builder.spec}
          onChange={updateBuilderSpec}
          onConfirm={confirmTableBuilder}
          onCancel={() => setBuilder(null)}
          onRestoreFocus={restoreActiveEditorFocus}
        />
      ) : null}
      {builder?.kind === 'mermaid' ? (
        <MermaidBuilderDialog
          spec={builder.spec}
          source={builder.source}
          editing={Number.isInteger(builder.position)}
          onChange={updateBuilderSpec}
          onSourceChange={updateBuilderSource}
          onConfirm={confirmMermaidBuilder}
          onCancel={() => setBuilder(null)}
          onRestoreFocus={restoreActiveEditorFocus}
        />
      ) : null}
      <CommandPalette open={commandOpen} commands={commands} onClose={() => setCommandOpen(false)} />
      {notice ? <div className="notice" role="status">{notice}</div> : null}
    </div>
  )
}
