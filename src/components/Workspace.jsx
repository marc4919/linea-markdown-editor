import { useCallback, useEffect, useRef, useState } from 'react'
import LiveEditorPane from './LiveEditorPane.jsx'
import OutlinePane from './OutlinePane.jsx'
import PreviewPane from './PreviewPane.jsx'

export default function Workspace({ markdown, mode, onModeChange, onMarkdownChange, onCursorChange, onSelectionChange, onEditorKeyDown, onUndo, onRedo, textareaRef, outlineCollapsed, onToggleOutline, onNavigate }) {
  const workspaceRef = useRef(null)
  const draggingRef = useRef(false)
  const [split, setSplit] = useState(50)

  const handlePointerMove = useCallback((event) => {
    if (!draggingRef.current) return
    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (!bounds) return
    const nextSplit = ((event.clientX - bounds.left) / bounds.width) * 100
    setSplit(Math.min(68, Math.max(32, nextSplit)))
  }, [])

  const stopDragging = useCallback(() => {
    draggingRef.current = false
    document.body.classList.remove('is-resizing')
  }, [])

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDragging)
      stopDragging()
    }
  }, [handlePointerMove, stopDragging])

  useEffect(() => {
    if (mode !== 'preview') textareaRef.current?.requestMeasure?.()
  }, [mode, textareaRef])

  const startDragging = (event) => {
    event.preventDefault()
    draggingRef.current = true
    document.body.classList.add('is-resizing')
  }

  const resizeWithKeyboard = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Home') setSplit(32)
    else if (event.key === 'End') setSplit(68)
    else setSplit((current) => Math.min(68, Math.max(32, current + (event.key === 'ArrowRight' ? 2 : -2))))
  }

  return (
    <div className="workspace-frame">
      <OutlinePane markdown={markdown} collapsed={outlineCollapsed} onToggle={onToggleOutline} onNavigate={onNavigate} />
      <main
        id="workspace"
        ref={workspaceRef}
        className={`workspace mode-${mode}`}
        style={{ '--editor-width': `${split}%` }}
      >
        <div className="mobile-view-switch" role="group" aria-label="Vista del documento">
          <button type="button" className={mode === 'live' || mode === 'split' ? 'is-active' : ''} aria-pressed={mode === 'live' || mode === 'split'} onClick={() => onModeChange('live')}>Live</button>
          <button type="button" className={mode === 'source' ? 'is-active' : ''} aria-pressed={mode === 'source'} onClick={() => onModeChange('source')}>Fuente</button>
          <button type="button" className={mode === 'preview' ? 'is-active' : ''} aria-pressed={mode === 'preview'} onClick={() => onModeChange('preview')}>Vista previa</button>
        </div>
        <LiveEditorPane
          markdown={markdown}
          variant={mode === 'source' ? 'source' : 'live'}
          onChange={onMarkdownChange}
          onCursorChange={onCursorChange}
          onSelectionChange={onSelectionChange}
          onKeyDown={onEditorKeyDown}
          onUndo={onUndo}
          onRedo={onRedo}
          textareaRef={textareaRef}
        />
        {mode === 'split' ? (
          <div
            className="splitter"
            role="separator"
            aria-label="Redimensionar paneles"
            aria-orientation="vertical"
            aria-valuemin="32"
            aria-valuemax="68"
            aria-valuenow={Math.round(split)}
            tabIndex="0"
            title="Arrastra o usa las flechas para redimensionar"
            onPointerDown={startDragging}
            onKeyDown={resizeWithKeyboard}
          ><span aria-hidden="true">••<br />••</span></div>
        ) : null}
        {mode === 'split' || mode === 'preview' ? <PreviewPane markdown={markdown} onNavigate={onNavigate} /> : null}
      </main>
    </div>
  )
}
