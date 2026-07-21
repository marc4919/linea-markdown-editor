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
  return (
    <aside className={`outline-pane${collapsed ? ' is-collapsed' : ''}`} aria-label="Estructura del documento">
      <div className="outline-header">
        <span>Estructura</span>
        <button type="button" aria-label={collapsed ? 'Mostrar estructura' : 'Ocultar estructura'} aria-expanded={!collapsed} onClick={onToggle}>
          <ChevronDownIcon />
        </button>
      </div>
      {!collapsed ? (
        <nav className="outline-list" aria-label="Encabezados">
          {headings.length ? headings.map((heading) => (
            <button
              key={`${heading.line}-${heading.text}`}
              type="button"
              style={{ '--outline-level': heading.level }}
              onClick={() => onNavigate(heading.line)}
            >
              {heading.text}
            </button>
          )) : <p>Los títulos aparecerán aquí.</p>}
        </nav>
      ) : null}
    </aside>
  )
}
