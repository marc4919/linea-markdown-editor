import { useEffect, useId, useRef, useState } from 'react'
import { CloseIcon, LinkIcon, TrashIcon } from './Icons.jsx'
import { normalizeMarkdownDestination } from '../lib/linkDestination.js'

export default function LinkPopover({ open, kind = 'link', initialLabel = '', initialUrl = 'https://', canRemove = false, onSubmit, onRemove, onClose }) {
  const [label, setLabel] = useState(initialLabel)
  const [url, setUrl] = useState(initialUrl)
  const [error, setError] = useState('')
  const urlRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    setLabel(initialLabel)
    setUrl(initialUrl)
    setError('')
    const timer = window.setTimeout(() => {
      urlRef.current?.focus()
      urlRef.current?.select()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [initialLabel, initialUrl, open])

  if (!open) return null
  const isImage = kind === 'image'

  const submit = (event) => {
    event.preventDefault()
    const normalized = normalizeMarkdownDestination(url, { image: isImage })
    if (!normalized) {
      setError('Introduce una dirección web válida.')
      return
    }
    onSubmit({ label: label.trim(), url: normalized })
  }

  return (
    <form
      className="link-popover"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }}
    >
      <div className="link-popover-heading">
        <LinkIcon />
        <strong id={titleId}>{isImage ? 'Insertar imagen' : canRemove ? 'Editar enlace' : 'Añadir enlace'}</strong>
        <button className="popover-close-button" type="button" aria-label="Cerrar" onClick={onClose}><CloseIcon /></button>
      </div>
      <label>
        <span>{isImage ? 'Descripción' : 'Texto'}</span>
        <input value={label} placeholder={isImage ? 'Describe la imagen' : 'Texto visible'} onChange={(event) => setLabel(event.target.value)} />
      </label>
      <label>
        <span>URL</span>
        <input ref={urlRef} inputMode="url" value={url} placeholder="https://ejemplo.com" aria-invalid={Boolean(error)} aria-describedby={error ? `${titleId}-error` : undefined} onChange={(event) => { setUrl(event.target.value); setError('') }} />
      </label>
      {error ? <p className="link-popover-error" id={`${titleId}-error`} role="alert">{error}</p> : null}
      <div className="link-popover-actions">
        {canRemove && !isImage ? <button className="link-remove" type="button" onClick={onRemove}><TrashIcon /> Quitar</button> : <span />}
        <button type="button" onClick={onClose}>Cancelar</button>
        <button className="primary" type="submit">{isImage ? 'Insertar' : 'Aplicar'}</button>
      </div>
    </form>
  )
}
