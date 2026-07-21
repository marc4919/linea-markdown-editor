import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  CodeIcon,
  DiagramIcon,
  FootnoteIcon,
  ImageIcon,
  MoreIcon,
  RuleIcon,
  StrikeIcon,
  TableIcon,
  TaskIcon,
  UnderlineIcon,
} from './Icons.jsx'

const groups = [
  {
    label: 'Formato',
    actions: [
      { id: 'underline', label: 'Subrayado', icon: UnderlineIcon },
      { id: 'strike', label: 'Tachado', icon: StrikeIcon },
      { id: 'task', label: 'Lista de tareas', icon: TaskIcon },
      { id: 'codeblock', label: 'Bloque de código', icon: CodeIcon },
      { id: 'rule', label: 'Separador', icon: RuleIcon },
    ],
  },
  {
    label: 'Contenido avanzado',
    actions: [
      { id: 'table', label: 'Tabla', icon: TableIcon },
      { id: 'image', label: 'Imagen por URL', icon: ImageIcon },
      { id: 'footnote', label: 'Nota al pie', icon: FootnoteIcon },
      { id: 'mermaid', label: 'Diagrama Mermaid', icon: DiagramIcon },
    ],
  },
]

export default function AdvancedMenu({ disabled, disabledActions = [], open, onOpenChange, onAction }) {
  const detailsRef = useRef(null)
  const summaryRef = useRef(null)
  const popoverId = useId()
  const [internalOpen, setInternalOpen] = useState(false)
  const controlled = open !== undefined
  const requestedOpen = controlled ? Boolean(open) : internalOpen
  const menuOpen = !disabled && requestedOpen

  const setOpen = useCallback((nextOpen) => {
    const next = Boolean(nextOpen)
    if (!controlled) setInternalOpen(next)
    onOpenChange?.(next)
  }, [controlled, onOpenChange])

  useEffect(() => {
    if (disabled && requestedOpen) setOpen(false)
  }, [disabled, requestedOpen, setOpen])

  useEffect(() => {
    if (!menuOpen) return undefined

    const closeFromOutside = (event) => {
      if (!detailsRef.current?.contains(event.target)) setOpen(false)
    }
    const closeWithEscape = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      summaryRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeFromOutside)
    document.addEventListener('focusin', closeFromOutside)
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside)
      document.removeEventListener('focusin', closeFromOutside)
      document.removeEventListener('keydown', closeWithEscape)
    }
  }, [menuOpen, setOpen])

  const run = (id) => {
    onAction?.(id)
    setOpen(false)
  }

  return (
    <div
      ref={detailsRef}
      className={`advanced-menu${disabled ? ' is-disabled' : ''}`}
    >
      <button
        ref={summaryRef}
        className="advanced-menu-trigger"
        type="button"
        aria-label="Más opciones de Markdown"
        aria-controls={popoverId}
        aria-expanded={menuOpen}
        aria-disabled={disabled || undefined}
        onClick={() => { if (!disabled) setOpen(!menuOpen) }}
      >
        <MoreIcon />
        <span>Más</span>
      </button>
      {menuOpen ? <div className="advanced-menu-popover" id={popoverId}>
        <header>
          <strong>Más opciones</strong>
          <small>Markdown avanzado sin llenar la barra</small>
        </header>
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <span>{group.label}</span>
            {group.actions.map(({ id, label, icon: ActionIcon }) => (
              <button key={id} type="button" disabled={disabledActions.includes(id)} onClick={() => run(id)}>
                <ActionIcon />
                {label}
              </button>
            ))}
          </section>
        ))}
      </div> : null}
    </div>
  )
}
