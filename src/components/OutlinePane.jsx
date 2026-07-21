import { ChevronDownIcon } from './Icons.jsx'

export function getHeadings(markdown) {
  return markdown.split('\n').flatMap((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)/)
    if (!match) return []
    return [{ level: match[1].length, text: match[2].replace(/[*_`]/g, ''), line: index + 1 }]
  })
}

export default function OutlinePane({ markdown, collapsed, onToggle, onNavigate }) {
  const headings = getHeadings(markdown)
  const hasHeadings = headings.length > 0
  const effectiveCollapsed = collapsed || !hasHeadings
  const toggle = () => {
    if (!hasHeadings) return
    onToggle()
  }

  return (
    <aside className={`outline-pane${effectiveCollapsed ? ' is-collapsed' : ''}${!hasHeadings ? ' is-empty' : ''}`} aria-label="Estructura del documento">
      <div className="outline-header">
        <span>Estructura</span>
        <button
          type="button"
          aria-label={!hasHeadings ? 'Estructura vacía' : effectiveCollapsed ? 'Mostrar estructura' : 'Ocultar estructura'}
          aria-expanded={!effectiveCollapsed}
          disabled={!hasHeadings}
          title={!hasHeadings ? 'Añade un título para crear la estructura' : undefined}
          onClick={toggle}
        >
          <ChevronDownIcon />
        </button>
      </div>
      {!effectiveCollapsed ? (
        <nav className="outline-list" aria-label="Encabezados">
          {headings.map((heading) => (
            <button
              key={`${heading.line}-${heading.text}`}
              type="button"
              style={{ '--outline-level': heading.level }}
              onClick={() => onNavigate(heading.line)}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      ) : null}
    </aside>
  )
}
