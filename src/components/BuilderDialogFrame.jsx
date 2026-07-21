import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function BuilderDialogFrame({ className = '', titleId, descriptionId, onCancel, onRestoreFocus, children }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(onCancel)
  const restoreFocusRef = useRef(onRestoreFocus)

  useEffect(() => {
    cancelRef.current = onCancel
    restoreFocusRef.current = onRestoreFocus
  }, [onCancel, onRestoreFocus])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current
      if (!dialog || dialog.contains(document.activeElement)) return
      dialog.querySelector('[autofocus], input, select, button')?.focus()
    })
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      cancelRef.current?.()
    }
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', closeOnEscape, true)
      restoreFocusRef.current?.()
    }
  }, [])

  const keepFocusInside = (event) => {
    if (event.key !== 'Tab') return
    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)]
      .filter((element) => element.tabIndex >= 0 && !element.hidden && element.getAttribute('aria-hidden') !== 'true')
    if (!focusable.length) {
      event.preventDefault()
      dialog.focus()
      return
    }
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="builder-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        ref={dialogRef}
        className={`builder-dialog${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex="-1"
        onKeyDown={keepFocusInside}
      >
        {children}
      </section>
    </div>
  )
}
