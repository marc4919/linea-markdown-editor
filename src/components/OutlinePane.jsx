import { ChevronDownIcon } from './Icons.jsx'

export function getHeadings(markdown) {
  return markdown.split('\n').flatMap((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)/)
    if (!match) return []
    return [{ level: match[1].length, text: match[2].replace(/[*_`]/g, ''), line: index + 1 }]
  })
}

export default function OutlinePane({ markdown, collapsed, mobileOpen, onToggle, onMobileClose, onNavigate }) {
  const headings = getHeadings(markdown)
  const hasHeadings = headings.length > 0
  const navigate = (heading, index) => {
    onNavigate({ ...heading, index })
    onMobileClose?.()
  }

  return (
    <>
      <button className={`outline-scrim${mobileOpen ? ' is-visible' : ''}`} type="button" aria-label="Cerrar panel de estructura" tabIndex={mobileOpen ? 0 : -1} onClick={onMobileClose} />
      <aside className={`outline-pane${collapsed ? ' is-collapsed' : ''}${!hasHeadings ? ' is-empty' : ''}${mobileOpen ? ' is-mobile-open' : ''}`} aria-label="Estructura del documento">
      <div className="outline-header">
        <span>Estructura</span>
        <button
          type="button"
          aria-label={mobileOpen ? 'Cerrar estructura' : collapsed ? 'Mostrar estructura' : 'Ocultar estructura'}
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          <ChevronDownIcon />
        </button>
      </div>
      {!collapsed || mobileOpen ? (
        <nav className="outline-list" aria-label="Encabezados">
          {hasHeadings ? headings.map((heading, index) => (
            <button
              key={`${heading.line}-${heading.text}`}
              type="button"
              style={{ '--outline-level': heading.level }}
              onClick={() => navigate(heading, index)}
            >
              {heading.text}
            </button>
          )) : <p>Añade títulos con Estilo → H1/H2 o escribe <code># Título</code> en Markdown.</p>}
        </nav>
      ) : null}
      </aside>
    </>
  )
}
