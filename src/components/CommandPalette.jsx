import { useEffect, useId, useMemo, useState } from 'react'
import { CloseIcon, CommandIcon, SearchIcon } from './Icons.jsx'
import {
  filterCommands,
  getFirstEnabledCommandIndex,
  getNextEnabledCommandIndex,
  isCommandExecutable,
} from '../lib/commandPalette.js'

export default function CommandPalette({ open, commands, onClose }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const paletteId = useId()
  const listboxId = `${paletteId}-commands`
  const filtered = useMemo(() => filterCommands(commands, query), [commands, query])
  const activeCommand = filtered[activeIndex]
  const activeOptionId = activeCommand ? `${paletteId}-command-${activeIndex}` : undefined

  useEffect(() => {
    setQuery('')
    setActiveIndex(-1)
  }, [open])

  useEffect(() => {
    if (!open) return
    setActiveIndex((currentIndex) => {
      if (filtered[currentIndex] && !filtered[currentIndex].disabled) return currentIndex
      return getFirstEnabledCommandIndex(filtered)
    })
  }, [filtered, open])

  useEffect(() => {
    if (!activeOptionId) return
    document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' })
  }, [activeOptionId])

  const executeCommand = (command) => {
    if (!isCommandExecutable(command)) return
    command.action()
    onClose()
  }

  const handleQueryChange = (event) => {
    const nextQuery = event.target.value
    setQuery(nextQuery)
    setActiveIndex(getFirstEnabledCommandIndex(filterCommands(commands, nextQuery)))
  }

  const handleSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((currentIndex) => getNextEnabledCommandIndex(filtered, currentIndex, direction))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      executeCommand(filtered[activeIndex])
    }
  }

  const handleDialogKeyDown = (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  if (!open) return null

  return (
    <div className="command-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos" onKeyDown={handleDialogKeyDown}>
        <div className="command-search">
          <SearchIcon />
          <input
            autoFocus
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded="true"
            aria-activedescendant={activeOptionId}
            value={query}
            placeholder="Buscar una acción…"
            aria-label="Buscar comando"
            onChange={handleQueryChange}
            onKeyDown={handleSearchKeyDown}
          />
          <button type="button" aria-label="Cerrar comandos" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="command-list">
          <div id={listboxId} role="listbox" aria-label="Comandos disponibles">
            {filtered.map((command, index) => {
              const selected = index === activeIndex
              return (
                <button
                  id={`${paletteId}-command-${index}`}
                  key={command.id}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  disabled={Boolean(command.disabled)}
                  aria-disabled={command.disabled ? 'true' : undefined}
                  aria-selected={selected}
                  style={selected ? { color: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}
                  onMouseEnter={() => {
                    if (!command.disabled) setActiveIndex(index)
                  }}
                  onClick={() => executeCommand(command)}
                >
                  <CommandIcon />
                  <span>{command.label}</span>
                  {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
                </button>
              )
            })}
          </div>
          {!filtered.length ? <p role="status">No hay comandos que coincidan.</p> : null}
        </div>
      </section>
    </div>
  )
}
