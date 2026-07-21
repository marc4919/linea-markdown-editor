import { CodeIcon, LiveIcon, PreviewIcon } from './Icons.jsx'

const mobileModes = [
  { id: 'rich', label: 'Edición enriquecida', icon: LiveIcon },
  { id: 'source', label: 'Markdown', icon: CodeIcon },
  { id: 'split', label: 'Resultado', icon: PreviewIcon },
]

export default function StatusBar({ words, characters, cursor, mode, onModeChange }) {
  const showCursor = mode === 'source' || mode === 'split'
  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <span>{words} {words === 1 ? 'palabra' : 'palabras'}</span>
        <span>{characters} {characters === 1 ? 'carácter' : 'caracteres'}</span>
        {showCursor ? <span className="status-cursor">Ln {cursor.line}, Col {cursor.column}</span> : null}
      </div>
      <div className="mobile-dock">
        <span className="mobile-stats" aria-label={`${words} palabras, ${characters} caracteres`}>{words} pal. · {characters} car.</span>
        <div className="mobile-mode-controls" role="group" aria-label="Vista del documento">
          {mobileModes.map(({ id, label, icon: ModeIcon }) => (
            <button
              key={id}
              type="button"
              className={mode === id ? 'is-active' : ''}
              aria-label={label}
              aria-pressed={mode === id}
              title={label}
              onClick={() => onModeChange(id)}
            ><ModeIcon /></button>
          ))}
        </div>
      </div>
    </footer>
  )
}
