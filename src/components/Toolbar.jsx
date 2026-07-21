import {
  CodeIcon,
  CommandIcon,
  DownloadIcon,
  EditIcon,
  FolderIcon,
  LiveIcon,
  MoreIcon,
  PlusIcon,
  PreviewIcon,
  SplitIcon,
} from './Icons.jsx'

const modes = [
  { id: 'rich', label: 'Edición enriquecida', icon: LiveIcon },
  { id: 'source', label: 'Markdown', icon: CodeIcon },
  { id: 'split', label: 'Comparar', icon: SplitIcon },
  { id: 'preview', label: 'Lectura', icon: PreviewIcon },
]

export default function Toolbar({ filename, mode, saveState, onModeChange, onNew, onOpen, onDownload, onExportHtml, onCommand, onRename }) {
  return (
    <header className="toolbar">
      <a className="brand" href="#workspace" aria-label="Línea, ir al editor">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>Línea</span>
      </a>

      <nav className="primary-actions" aria-label="Acciones de documento">
        <button type="button" aria-label="Nuevo documento" onClick={onNew}><PlusIcon /><span>Nuevo</span></button>
        <button type="button" aria-label="Abrir archivos" onClick={onOpen}><FolderIcon /><span>Abrir</span></button>
        <details className="export-menu">
          <summary aria-label="Exportar documento"><DownloadIcon /><span>Exportar</span></summary>
          <div>
            <button type="button" onClick={onDownload}>Markdown (.md)</button>
            <button type="button" onClick={onExportHtml}>Página web (.html)</button>
          </div>
        </details>
      </nav>

      <button className="active-filename" type="button" aria-label={`Renombrar ${filename}`} title="Renombrar documento" onClick={onRename}>
        <span>{filename}</span>
        <EditIcon />
      </button>

      <div className={`save-state is-${saveState.kind}`} role="status" aria-live="polite" aria-label={saveState.label} title={saveState.label}>
        <span className="save-check" aria-hidden="true">{saveState.kind === 'error' ? '!' : saveState.kind === 'saving' ? '·' : '✓'}</span>
        <span>{saveState.label}</span>
      </div>

      <div className="toolbar-actions">
        <button className="command-button" type="button" aria-label="Abrir paleta de comandos" title="Comandos (⌘⇧P)" onClick={onCommand}>
          <span className="command-icon command-icon-desktop" aria-hidden="true"><CommandIcon /></span>
          <span className="command-icon command-icon-mobile" aria-hidden="true"><MoreIcon /></span>
          <span className="command-label">Comandos</span>
          <kbd>⌘⇧P</kbd>
        </button>
        <div className="mode-switch" role="group" aria-label="Modo de visualización">
          {modes.map(({ id, label, icon: ModeIcon }) => (
            <button
              key={id}
              className={`icon-button${mode === id ? ' is-active' : ''}`}
              type="button"
              aria-label={label}
              aria-pressed={mode === id}
              title={label}
              onClick={() => onModeChange(id)}
            >
              <ModeIcon />
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
