import { useEffect, useId, useRef, useState } from 'react'
import { CloseIcon, FootnoteIcon } from './Icons.jsx'

export default function FootnotePopover({
  open,
  initialText = '',
  onSubmit,
  onClose,
  onRestoreFocus,
}) {
  const [noteText, setNoteText] = useState(initialText)
  const inputRef = useRef(null)
  const restoreFocusRef = useRef(onRestoreFocus)
  const titleId = useId()
  const descriptionId = `${titleId}-description`
  const content = noteText.trim()

  const closeAndRestore = () => {
    onClose?.()
    restoreFocusRef.current?.()
  }

  useEffect(() => {
    restoreFocusRef.current = onRestoreFocus
  }, [onRestoreFocus])

  useEffect(() => {
    if (!open) return
    setNoteText(initialText)
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [initialText, open])

  if (!open) return null

  const submit = (event) => {
    event.preventDefault()
    if (!content) return
    onSubmit?.(content)
  }

  return (
    <form
      className="link-popover footnote-popover"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        closeAndRestore()
      }}
    >
      <div className="link-popover-heading">
        <FootnoteIcon />
        <strong id={titleId}>Añadir nota al pie</strong>
        <button type="button" aria-label="Cerrar" onClick={closeAndRestore}><CloseIcon /></button>
      </div>
      <p className="sr-only" id={descriptionId}>Escribe el contenido antes de insertar la referencia y su nota.</p>
      <label>
        <span>Texto de la nota</span>
        <input
          ref={inputRef}
          value={noteText}
          placeholder="Contenido de la nota"
          autoComplete="off"
          onChange={(event) => setNoteText(event.target.value)}
        />
      </label>
      <div className="link-popover-actions">
        <span />
        <button type="button" onClick={closeAndRestore}>Cancelar</button>
        <button className="primary" type="submit" disabled={!content}>Insertar</button>
      </div>
    </form>
  )
}
