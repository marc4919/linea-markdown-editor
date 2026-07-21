import { useEffect, useMemo, useState } from 'react'
import { CloseIcon, CommandIcon, SearchIcon } from './Icons.jsx'

export default function CommandPalette({ open, commands, onClose }) {
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (open) setQuery('')
  }, [open])
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es')
    return normalized ? commands.filter((command) => command.label.toLocaleLowerCase('es').includes(normalized)) : commands
  }, [commands, query])
  if (!open) return null
  return (
    <div className="command-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
        <div className="command-search">
          <SearchIcon />
          <input autoFocus value={query} placeholder="Buscar una acción…" aria-label="Buscar comando" onChange={(event) => setQuery(event.target.value)} />
          <button type="button" aria-label="Cerrar comandos" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="command-list" role="listbox" aria-label="Comandos disponibles">
          {filtered.length ? filtered.map((command) => (
            <button key={command.id} type="button" role="option" onClick={() => { command.action(); onClose() }}>
              <CommandIcon />
              <span>{command.label}</span>
              {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
            </button>
          )) : <p>No hay comandos que coincidan.</p>}
        </div>
      </section>
    </div>
  )
}
