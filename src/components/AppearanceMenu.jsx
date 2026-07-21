import { useEffect, useRef } from 'react'

export default function AppearanceMenu({ fontFamily, onFontChange, onEnterFocusMode }) {
  const detailsRef = useRef(null)

  useEffect(() => {
    const closeOutside = (event) => {
      if (!detailsRef.current?.contains(event.target)) detailsRef.current?.removeAttribute('open')
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  const run = (action) => {
    action()
    detailsRef.current?.removeAttribute('open')
  }

  return (
    <details className="appearance-menu" ref={detailsRef}>
      <summary aria-label="Apariencia y concentración" title="Apariencia">Aa</summary>
      <div>
        <span>Tipografía</span>
        <div className="appearance-fonts" role="group" aria-label="Tipografía de lectura y escritura">
          <button type="button" aria-pressed={fontFamily === 'serif'} onClick={() => run(() => onFontChange('serif'))}>Serifa</button>
          <button type="button" aria-pressed={fontFamily === 'sans'} onClick={() => run(() => onFontChange('sans'))}>Sin serifa</button>
        </div>
        <span>Concentración</span>
        <button type="button" onClick={() => run(() => onEnterFocusMode('write'))}>Escribir sin interfaz</button>
        <button type="button" onClick={() => run(() => onEnterFocusMode('read'))}>Leer sin interfaz</button>
      </div>
    </details>
  )
}
