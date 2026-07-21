import { useMemo, useRef } from 'react'

export default function EditorPane({ markdown, onChange, onCursorChange, onSelectionChange, onKeyDown, textareaRef }) {
  const lineNumbersRef = useRef(null)
  const lineNumbers = useMemo(() => Array.from({ length: Math.max(markdown.split('\n').length, 18) }, (_, i) => i + 1), [markdown])

  const reportSelection = (textarea) => {
    onCursorChange(textarea)
    onSelectionChange?.({ start: textarea.selectionStart, end: textarea.selectionEnd, direction: textarea.selectionDirection })
  }

  return (
    <section className="pane editor-pane" aria-labelledby="editor-heading">
      <div className="pane-heading" id="editor-heading">Markdown</div>
      <div className="editor-surface">
        <div ref={lineNumbersRef} className="line-numbers" aria-hidden="true">
          {lineNumbers.map((line) => <span key={line}>{line}</span>)}
        </div>
        <textarea
          ref={textareaRef}
          aria-label="Contenido Markdown"
          value={markdown}
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => reportSelection(event.currentTarget)}
          onKeyDown={onKeyDown}
          onKeyUp={(event) => reportSelection(event.currentTarget)}
          onSelect={(event) => reportSelection(event.currentTarget)}
          onScroll={(event) => { if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop }}
          spellCheck="true"
        />
      </div>
    </section>
  )
}
