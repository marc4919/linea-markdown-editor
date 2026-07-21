import { useEffect, useRef } from 'react'
import { CloseIcon } from './Icons.jsx'

const examples = [
  ['Cabeceras', '# H1 · ## H2 · ### H3'],
  ['Negrita', '**texto importante**'],
  ['Cursiva', '_texto con énfasis_'],
  ['Enlace', '[nombre](https://...)'],
  ['Lista', '- Un elemento'],
  ['Tarea', '- [ ] Pendiente'],
  ['Cita', '> Una idea para recordar'],
  ['Código', '`fragmento`'],
]

export default function QuickGuide({ open, onClose }) {
  const closeRef = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    closeRef.current?.focus()
    const onKeyDown = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
  if (!open) return null
  return (
    <aside className="quick-guide is-open" role="dialog" aria-modal="true" aria-label="Guía rápida de Markdown">
      <div className="guide-header">
        <div>
          <p>Guía rápida</p>
          <h2>Escribe sin memorizar sintaxis</h2>
        </div>
        <button ref={closeRef} type="button" aria-label="Cerrar guía" onClick={onClose}><CloseIcon /></button>
      </div>
      <p className="guide-intro">Selecciona un texto y usa la barra. Si el formato ya está activo, Línea lo quitará sin tocar el contenido.</p>
      <dl>
        {examples.map(([term, example]) => (
          <div key={term}><dt>{term}</dt><dd><code>{example}</code></dd></div>
        ))}
      </dl>
      <p className="guide-tip"><strong>Consejo:</strong> abre la paleta con <kbd>⌘K</kbd> para encontrar cualquier acción.</p>
    </aside>
  )
}
