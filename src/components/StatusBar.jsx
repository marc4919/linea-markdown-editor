import { CheckIcon, MenuIcon } from './Icons.jsx'

export default function StatusBar({ words, cursor, dirty, saveState }) {
  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <MenuIcon />
        <span>{words} {words === 1 ? 'palabra' : 'palabras'}</span>
        <span className="separator" />
        <span>Ln {cursor.line}, Col {cursor.column}</span>
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
