import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CommandPalette from './components/CommandPalette.jsx'
import { ConfirmDialog, ImportDialog, RenameDialog } from './components/Dialog.jsx'
import DocumentTabs from './components/DocumentTabs.jsx'
import DropOverlay from './components/DropOverlay.jsx'
import FormattingToolbar from './components/FormattingToolbar.jsx'
import QuickGuide from './components/QuickGuide.jsx'
import StatusBar from './components/StatusBar.jsx'
import Toolbar from './components/Toolbar.jsx'
import Workspace from './components/Workspace.jsx'
import { STARTER_MARKDOWN } from './data.js'
import {
  getFormattingState,
  setHeading,
  toggleBold,
  toggleInlineCode,
  toggleItalic,
  toggleLink,
  toggleList,
  toggleQuote,
} from './lib/formatting.js'
import { renderMarkdown } from './lib/markdown.js'
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
const EMPTY_SELECTION = { start: 0, end: 0, direction: 'none' }

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
  const [saveState, setSaveState] = useState(() => restoreRef.current?.ok === false
    ? { kind: 'error', label: 'No se pudo recuperar' }
    : { kind: 'saved', label: 'Guardado en Línea' })
  const [mode, setMode] = useState('split')
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
  const [notice, setNotice] = useState('')
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const dragDepthRef = useRef(0)
  const selectionsRef = useRef(new Map())
  const historyRef = useRef(new Map())

  const activeTab = getActiveTab(workspace)
  const activeId = activeTab.id

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

  const recordHistory = useCallback((tabId, previousMarkdown) => {
    const history = historyRef.current.get(tabId) || { past: [], future: [] }
    if (history.past.at(-1) !== previousMarkdown) history.past.push(previousMarkdown)
    if (history.past.length > 150) history.past.shift()
    history.future = []
    historyRef.current.set(tabId, history)
  }, [])

  const updateMarkdown = useCallback((markdown, { record = true } = {}) => {
    if (markdown === activeTab.markdown) return
    if (record) recordHistory(activeId, activeTab.markdown)
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
    setWorkspace((current) => createTab(current))
    setSelection(EMPTY_SELECTION)
    setMode((current) => current === 'preview' ? 'edit' : current)
    window.setTimeout(() => textareaRef.current?.focus(), 0)
  }, [])

  const performClose = useCallback((tabId) => {
    selectionsRef.current.delete(tabId)
    historyRef.current.delete(tabId)
    setWorkspace((current) => closeTab(current, tabId))
    setSelection(EMPTY_SELECTION)
  }, [])

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
    let next = workspace
    for (const file of pendingFiles) {
      next = createTab(next, { filename: file.name, markdown: file.content, dirty: false, exported: true })
    }
    setWorkspace(next)
    setPendingFiles([])
    setSelection(EMPTY_SELECTION)
    setMode((current) => current === 'preview' ? 'edit' : current)
  }, [pendingFiles, workspace])

  const performReplace = useCallback(() => {
    const file = pendingFiles[0]
    if (!file) return
    setWorkspace((current) => replaceTab(current, current.activeTabId, {
      filename: file.name,
      markdown: file.content,
      dirty: false,
      exported: true,
    }))
    historyRef.current.delete(activeId)
    setPendingFiles([])
    setConfirmation(null)
    setSelection(EMPTY_SELECTION)
  }, [activeId, pendingFiles])

  const requestReplace = useCallback(() => {
    if (needsDiscardConfirmation(activeTab)) {
      setConfirmation({
        type: 'replace',
        title: `Reemplazar «${activeTab.filename}»`,
        message: 'Esta pestaña contiene cambios sin exportar. El archivo nuevo ocupará su lugar.',
        confirmLabel: 'Reemplazar sin exportar',
      })
      return
    }
    performReplace()
  }, [activeTab, performReplace])

  const confirmAction = useCallback(() => {
    if (confirmation?.type === 'close') performClose(confirmation.tabId)
    if (confirmation?.type === 'replace') performReplace()
    setConfirmation(null)
  }, [confirmation, performClose, performReplace])

  const exportMarkdown = useCallback(() => {
    const filename = markdownFilename(activeTab.filename)
    downloadBlob(activeTab.markdown, 'text/markdown;charset=utf-8', filename)
    setWorkspace((current) => markTabExported(current, current.activeTabId, { filename }))
    setNotice(`Exportado como ${filename}`)
  }, [activeTab])

  const exportHtml = useCallback(() => {
    const filename = markdownFilename(activeTab.filename).replace(/\.md$/i, '.html')
    const title = escapeDocumentTitle(activeTab.filename.replace(/\.md$/i, '') || 'Documento')
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{max-width:760px;margin:64px auto;padding:0 24px;color:#211f1c;font:19px/1.6 Georgia,serif}h1{font-size:48px;line-height:1.05}h2{font-size:32px}pre{overflow:auto;padding:18px;background:#292723;color:#fff}code{font-family:monospace}blockquote{border-left:3px solid #c92e28;padding-left:18px;color:#666}img{max-width:100%}</style></head><body>${renderMarkdown(activeTab.markdown)}</body></html>`
    downloadBlob(html, 'text/html;charset=utf-8', filename)
    setWorkspace((current) => markTabExported(current, current.activeTabId))
    setNotice(`Exportado como ${filename}`)
  }, [activeTab])

  const openRename = useCallback(() => {
    setRenameValue(activeTab.filename)
    setRenameOpen(true)
  }, [activeTab.filename])

  const confirmRename = useCallback(() => {
    const filename = markdownFilename(renameValue)
    setWorkspace((current) => renameTab(current, current.activeTabId, filename))
    setRenameOpen(false)
  }, [renameValue])

  const applyResult = useCallback((result) => {
    updateMarkdown(result.text)
    restoreEditorSelection({ start: result.selectionStart, end: result.selectionEnd, direction: 'none' })
  }, [restoreEditorSelection, updateMarkdown])

  const applyFormat = useCallback((format) => {
    if (mode === 'preview') return
    const functions = {
      bold: toggleBold,
      italic: toggleItalic,
      link: toggleLink,
      list: toggleList,
      quote: toggleQuote,
      code: toggleInlineCode,
    }
    const transform = functions[format]
    if (!transform) return
    applyResult(transform(activeTab.markdown, selection.start, selection.end))
  }, [activeTab.markdown, applyResult, mode, selection.end, selection.start])

  const applyHeading = useCallback((level) => {
    if (mode === 'preview') return
    applyResult(setHeading(activeTab.markdown, selection.start, selection.end, level))
  }, [activeTab.markdown, applyResult, mode, selection.end, selection.start])

  const undo = useCallback(() => {
    const history = historyRef.current.get(activeId)
    const previous = history?.past.pop()
    if (previous === undefined) return
    history.future.unshift(activeTab.markdown)
    setWorkspace(editTab(workspace, activeId, previous))
  }, [activeId, activeTab.markdown, workspace])

  const redo = useCallback(() => {
    const history = historyRef.current.get(activeId)
    const next = history?.future.shift()
    if (next === undefined) return
    history.past.push(activeTab.markdown)
    setWorkspace(editTab(workspace, activeId, next))
  }, [activeId, activeTab.markdown, workspace])

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
    const command = event.metaKey || event.ctrlKey
    if (!command) return
    const key = event.key.toLowerCase()
    if (key === 'b' || key === 'i') {
      event.preventDefault()
      applyFormat(key === 'b' ? 'bold' : 'italic')
    }
    if (event.altKey && /^[1-6]$/.test(event.key)) {
      event.preventDefault()
      applyHeading(Number(event.key))
    }
  }, [applyFormat, applyHeading])

  const navigateToLine = useCallback((line) => {
    const targetLine = Math.max(1, line)
    const lines = activeTab.markdown.split('\n')
    const start = lines.slice(0, targetLine - 1).reduce((total, value) => total + value.length + 1, 0)
    if (mode === 'preview') setMode('edit')
    const nextSelection = { start, end: start, direction: 'none' }
    restoreEditorSelection(nextSelection)
    window.setTimeout(() => {
      if (textareaRef.current) textareaRef.current.scrollTop = Math.max(0, (targetLine - 2) * 23.4)
    }, 0)
  }, [activeTab.markdown, mode, restoreEditorSelection])

  const toggleFocusMode = useCallback(() => {
    if (!focusMode) {
      setMode('edit')
      setFocusMode(true)
      return
    }
    setFocusMode(false)
  }, [focusMode])

  useEffect(() => {
    const onKeyDown = (event) => {
      const command = event.metaKey || event.ctrlKey
      if (event.key === 'Escape') {
        setCommandOpen(false)
        setConfirmation(null)
        setPendingFiles([])
        setRenameOpen(false)
        setDropActive(false)
      }
      if (!command) return
      const key = event.key.toLowerCase()
      if (key === 'k') { event.preventDefault(); setCommandOpen((current) => !current) }
      if (key === 't') { event.preventDefault(); createDocument() }
      if (key === 'o') {
        event.preventDefault()
        openFilePicker()
      }
      if (key === 'w') { event.preventDefault(); requestClose(activeId) }
      if (key === 'z' && event.shiftKey) { event.preventDefault(); redo() }
      else if (key === 'z' && document.activeElement === textareaRef.current) { event.preventDefault(); undo() }
      if (/^[1-9]$/.test(event.key) && !event.altKey) {
        const tab = workspace.tabs[Number(event.key) - 1]
        if (tab) { event.preventDefault(); activateDocument(tab.id) }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activateDocument, activeId, createDocument, openFilePicker, redo, requestClose, undo, workspace.tabs])

  const formatState = useMemo(() => {
    const state = getFormattingState(activeTab.markdown, selection.start, selection.end)
    return { ...state, headingLevel: state.heading }
  }, [activeTab.markdown, selection.end, selection.start])

  const wordCount = useMemo(() => {
    const plainText = activeTab.markdown.replace(/[#>*_`\-[\]()~]/g, ' ').trim()
    return plainText ? plainText.split(/\s+/).length : 0
  }, [activeTab.markdown])

  const commands = [
    { id: 'new', label: 'Nuevo documento', shortcut: '⌘T', action: createDocument },
    { id: 'open', label: 'Abrir archivos', shortcut: '⌘O', action: openFilePicker },
    { id: 'rename', label: 'Renombrar documento', action: openRename },
    { id: 'export', label: 'Exportar Markdown', action: exportMarkdown },
    { id: 'outline', label: outlineCollapsed ? 'Mostrar estructura' : 'Ocultar estructura', action: () => setOutlineCollapsed((current) => !current) },
    { id: 'edit', label: 'Cambiar a modo Editar', action: () => setMode('edit') },
    { id: 'split', label: 'Cambiar a modo Dividir', action: () => setMode('split') },
    { id: 'preview', label: 'Cambiar a Vista previa', action: () => setMode('preview') },
    { id: 'focus', label: focusMode ? 'Salir del modo concentración' : 'Entrar en modo concentración', action: toggleFocusMode },
    { id: 'guide', label: 'Abrir guía rápida', action: () => setGuideOpen(true) },
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
        onModeChange={setMode}
        onNew={createDocument}
        onOpen={openFilePicker}
        onDownload={exportMarkdown}
        onExportHtml={exportHtml}
        onCommand={() => setCommandOpen(true)}
        onRename={openRename}
      />
      <DocumentTabs documents={workspace.tabs} activeId={activeId} onActivate={activateDocument} onClose={requestClose} onNew={createDocument} />
      <FormattingToolbar
        onFormat={applyFormat}
        onHeading={applyHeading}
        formatState={formatState}
        disabled={mode === 'preview'}
        onUndo={undo}
        onRedo={redo}
        guideOpen={guideOpen}
        onToggleGuide={() => setGuideOpen((current) => !current)}
      />
      <input ref={fileInputRef} hidden tabIndex="-1" aria-hidden="true" type="file" multiple accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={handleFileInput} />
      <Workspace
        markdown={activeTab.markdown}
        mode={mode}
        onModeChange={setMode}
        onMarkdownChange={updateMarkdown}
        onCursorChange={updateCursor}
        onSelectionChange={updateSelection}
        onEditorKeyDown={handleEditorKeyDown}
        textareaRef={textareaRef}
        outlineCollapsed={outlineCollapsed}
        onToggleOutline={() => setOutlineCollapsed((current) => !current)}
        onNavigate={navigateToLine}
      />
      <StatusBar words={wordCount} cursor={cursor} dirty={activeTab.dirty} saveState={saveState} />
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
      <CommandPalette open={commandOpen} commands={commands} onClose={() => setCommandOpen(false)} />
      {notice ? <div className="notice" role="status">{notice}</div> : null}
    </div>
  )
}
