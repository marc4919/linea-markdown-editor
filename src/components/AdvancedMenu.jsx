import { useRef } from 'react'
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
} from './Icons.jsx'

const groups = [
  {
    label: 'Formato',
    actions: [
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

export default function AdvancedMenu({ disabled, onAction }) {
  const detailsRef = useRef(null)

  const run = (id) => {
    detailsRef.current?.removeAttribute('open')
    onAction(id)
  }

  return (
    <details ref={detailsRef} className={`advanced-menu${disabled ? ' is-disabled' : ''}`}>
      <summary aria-label="Más opciones de Markdown" aria-disabled={disabled || undefined} onClick={(event) => { if (disabled) event.preventDefault() }}>
        <MoreIcon />
        <span>Más</span>
      </summary>
      <div className="advanced-menu-popover">
        <header>
          <strong>Más opciones</strong>
          <small>Markdown avanzado sin llenar la barra</small>
        </header>
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <span>{group.label}</span>
            {group.actions.map(({ id, label, icon: ActionIcon }) => (
              <button key={id} type="button" onClick={() => run(id)}>
                <ActionIcon />
                {label}
              </button>
            ))}
          </section>
        ))}
      </div>
    </details>
  )
}
