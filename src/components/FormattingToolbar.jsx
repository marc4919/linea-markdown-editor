import { useCallback, useState } from 'react'
import {
  BoldIcon,
  CodeIcon,
  HelpIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  QuoteIcon,
  RedoIcon,
  UndoIcon,
} from './Icons.jsx'
import AdvancedMenu from './AdvancedMenu.jsx'
import FootnotePopover from './FootnotePopover.jsx'
import LinkPopover from './LinkPopover.jsx'

const tools = [
  { id: 'bold', label: 'Negrita', shortcut: '⌘B', icon: BoldIcon },
  { id: 'italic', label: 'Cursiva', shortcut: '⌘I', icon: ItalicIcon },
  { id: 'link', label: 'Enlace', shortcut: '⌘K', icon: LinkIcon },
  { id: 'list', label: 'Lista', icon: ListIcon },
  { id: 'quote', label: 'Cita', icon: QuoteIcon },
  { id: 'code', label: 'Código', icon: CodeIcon },
]

export default function FormattingToolbar({
  onFormat,
  onHeading,
  formatState = {},
  disabled,
  onUndo,
  onRedo,
  onToggleGuide,
  guideOpen,
  onRequestLink,
  linkEditor,
  onAdvancedAction,
  advancedOpen,
  onAdvancedOpenChange,
  footnoteEditor,
}) {
  const headingValue = formatState.headingLevel ? String(formatState.headingLevel) : '0'
  const blockFormattingDisabled = Boolean(formatState.blockFormattingDisabled)
  const [internalAdvancedOpen, setInternalAdvancedOpen] = useState(false)
  const advancedControlled = advancedOpen !== undefined
  const resolvedAdvancedOpen = advancedControlled ? Boolean(advancedOpen) : internalAdvancedOpen
  const setAdvancedOpen = useCallback((nextOpen) => {
    const next = Boolean(nextOpen)
    if (!advancedControlled) setInternalAdvancedOpen(next)
    onAdvancedOpenChange?.(next)
  }, [advancedControlled, onAdvancedOpenChange])
  const closeAdvanced = useCallback(() => {
    if (resolvedAdvancedOpen) setAdvancedOpen(false)
  }, [resolvedAdvancedOpen, setAdvancedOpen])

  return (
    <nav className={`formatting-toolbar${disabled ? ' is-disabled' : ''}`} aria-label="Herramientas de formato">
      <div className="history-tools" aria-label="Historial">
        <button type="button" aria-label="Deshacer" title="Deshacer (⌘Z)" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => { closeAdvanced(); onUndo?.() }}><UndoIcon /></button>
        <button type="button" aria-label="Rehacer" title="Rehacer (⇧⌘Z)" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => { closeAdvanced(); onRedo?.() }}><RedoIcon /></button>
      </div>
      <label className="heading-control">
        <span className="sr-only">Estilo de párrafo</span>
        <select value={headingValue} disabled={disabled || blockFormattingDisabled} onChange={(event) => { closeAdvanced(); onHeading?.(Number(event.target.value)) }}>
          <option value="0">Párrafo</option>
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
          <option value="4">H4</option>
          <option value="5">H5</option>
          <option value="6">H6</option>
        </select>
      </label>
      <div className="formatting-tools">
        {tools.map(({ id, label, shortcut, icon: ToolIcon }) => {
          const active = Boolean(formatState[id])
          const toolDisabled = disabled || (blockFormattingDisabled && (id === 'list' || id === 'quote'))
          if (id === 'link') {
            return (
              <div className="link-tool-wrapper" key={id}>
                <button
                  className={`format-button${active ? ' is-active' : ''}`}
                  type="button"
                  aria-label="Enlace ⌘K"
                  aria-pressed={active}
                  title="Enlace (⌘K)"
                  disabled={toolDisabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { closeAdvanced(); onRequestLink?.() }}
                >
                  <LinkIcon />
                  <span>Enlace</span>
                  <kbd>⌘K</kbd>
                </button>
                <LinkPopover {...linkEditor} />
              </div>
            )
          }
          return (
            <button
              key={id}
              className={`format-button${active ? ' is-active' : ''}`}
              type="button"
              aria-label={`${label}${shortcut ? ` ${shortcut}` : ''}`}
              aria-pressed={active}
              title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
              disabled={toolDisabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { closeAdvanced(); onFormat?.(id) }}
            >
              <ToolIcon />
              <span>{label}</span>
              {shortcut ? <kbd>{shortcut}</kbd> : null}
            </button>
          )
        })}
      </div>
      <div className="footnote-tool-wrapper">
        <AdvancedMenu
          disabled={disabled}
          disabledActions={blockFormattingDisabled ? ['task', 'codeblock', 'rule'] : []}
          open={resolvedAdvancedOpen}
          onOpenChange={setAdvancedOpen}
          onAction={onAdvancedAction}
        />
        <FootnotePopover {...footnoteEditor} />
      </div>
      <button
        className={`guide-button${guideOpen ? ' is-active' : ''}`}
        type="button"
        aria-label="Guía rápida"
        aria-expanded={guideOpen}
        onClick={() => { closeAdvanced(); onToggleGuide?.() }}
      >
        <HelpIcon />
        <span>Guía</span>
      </button>
    </nav>
  )
}
