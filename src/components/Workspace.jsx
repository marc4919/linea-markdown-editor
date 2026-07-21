import { useCallback, useEffect, useRef, useState } from 'react'
import LiveEditorPane from './LiveEditorPane.jsx'
import OutlinePane from './OutlinePane.jsx'
import PreviewPane from './PreviewPane.jsx'
import RichEditorPane from './RichEditorPane.jsx'

export default function Workspace({
  documentId,
  markdown,
  mode,
  onMarkdownChange,
  onCursorChange,
  onSelectionChange,
  onEditorKeyDown,
  onUndo,
  onRedo,
  textareaRef,
  richEditorRef,
  onRichFormatStateChange,
  onEditMermaid,
  outlineCollapsed,
  mobileOutlineOpen,
  onToggleOutline,
  onCloseMobileOutline,
  onNavigate,
}) {
  const workspaceRef = useRef(null)
  const previewRef = useRef(null)
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
    if (mode === 'source' || mode === 'split') textareaRef.current?.requestMeasure?.()
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

  const navigateToHeading = (heading) => {
    const mobileResult = mode === 'split' && window.matchMedia('(max-width: 760px)').matches
    if (mode === 'rich') richEditorRef.current?.navigateToHeading?.(heading.index)
    else if (mobileResult) previewRef.current?.scrollToLine?.(heading.line)
    else onNavigate(heading.line)
    onCloseMobileOutline?.()
  }

  return (
    <div className="workspace-frame">
      <OutlinePane
        markdown={markdown}
        collapsed={outlineCollapsed}
        mobileOpen={mobileOutlineOpen}
        onToggle={onToggleOutline}
        onMobileClose={onCloseMobileOutline}
        onNavigate={navigateToHeading}
      />
      <main
        id="workspace"
        ref={workspaceRef}
        className={`workspace mode-${mode}`}
        style={{ '--editor-width': `${split}%` }}
      >
        {mode === 'rich' ? (
          <RichEditorPane
            key={documentId}
            ref={richEditorRef}
            markdown={markdown}
            onChange={onMarkdownChange}
            onFormatStateChange={onRichFormatStateChange}
            onEditMermaid={onEditMermaid}
          />
        ) : null}
        {mode === 'source' || mode === 'split' ? (
          <LiveEditorPane
            markdown={markdown}
            onChange={onMarkdownChange}
            onCursorChange={onCursorChange}
            onSelectionChange={onSelectionChange}
            onKeyDown={onEditorKeyDown}
            onUndo={onUndo}
            onRedo={onRedo}
            textareaRef={textareaRef}
          />
        ) : null}
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
        {mode === 'split' ? <PreviewPane ref={previewRef} markdown={markdown} /> : null}
      </main>
    </div>
  )
}
