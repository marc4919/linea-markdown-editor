import { CheckIcon, MenuIcon } from './Icons.jsx'

const modeLabels = {
  rich: 'Edición enriquecida',
  source: 'Markdown',
  split: 'Comparar',
  preview: 'Lectura',
}

export default function StatusBar({ words, cursor, mode, dirty, saveState }) {
  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <MenuIcon />
        <span>{words} {words === 1 ? 'palabra' : 'palabras'}</span>
        <span className="separator" />
        <span>{mode === 'source' || mode === 'split' ? `Ln ${cursor.line}, Col ${cursor.column}` : modeLabels[mode]}</span>
        <span className="separator" />
        <span className={dirty ? 'dirty-state' : 'clean-state'}>{dirty ? 'Cambios sin exportar' : 'Exportado'}</span>
      </div>
      <div className="statusbar-right">
        <span>{saveState.label}</span>
        <span className="separator" />
        <span>Markdown</span>
        <span className="separator" />
        <span>UTF-8</span>
        {saveState.kind === 'saved' ? <span className="status-ok"><CheckIcon size={16} /></span> : null}
      </div>
    </footer>
  )
}
