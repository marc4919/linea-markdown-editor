import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { CloseIcon, DiagramIcon, PlusIcon, TrashIcon } from './Icons.jsx'
import BuilderDialogFrame from './BuilderDialogFrame.jsx'
import {
  MERMAID_LIMITS,
  createMermaidSource,
  getMermaidFlowchartStepIndex,
  getDefaultMermaidSpec,
  reorderMermaidItems,
} from '../lib/advancedBuilders.js'

const TEMPLATES = [
  { type: 'flowchart', label: 'Flujo', description: 'Pasos conectados en orden' },
  { type: 'sequence', label: 'Secuencia', description: 'Mensajes entre participantes' },
  { type: 'timeline', label: 'Cronología', description: 'Eventos ordenados por etapa o fecha' },
  { type: 'pie', label: 'Circular', description: 'Categorías comparadas por valor' },
]
const TEMPLATE_TYPES = new Set(TEMPLATES.map((template) => template.type))
const MERMAID_DRAG_TYPE = 'application/x-linea-mermaid-index'

let mermaidLoader
let mermaidPreviewSequence = 0

function loadMermaid() {
  if (!mermaidLoader) {
    mermaidLoader = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' })
      return mermaid
    }).catch((error) => {
      mermaidLoader = null
      throw error
    })
  }
  return mermaidLoader
}

function replaceAt(items, index, nextItem) {
  return items.map((item, itemIndex) => itemIndex === index ? nextItem : item)
}

function SectionLegend({ number, children }) {
  return <><span className="mermaid-section-number" aria-hidden="true">{number}</span>{children}</>
}

function MermaidSortableRow({ className = '', index, label, onReorder, children }) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <div
      className={`${className} mermaid-sortable-row${dragOver ? ' is-drag-over' : ''}`}
      role="group"
      aria-label={label}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setDragOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragOver(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragOver(false)
        const value = event.dataTransfer.getData(MERMAID_DRAG_TYPE) || event.dataTransfer.getData('text/plain')
        const fromIndex = Number(value)
        if (Number.isInteger(fromIndex) && fromIndex !== index) onReorder(fromIndex, index)
      }}
    >
      <span
        className="mermaid-drag-handle"
        draggable="true"
        title={`Arrastrar ${label.toLowerCase()}`}
        aria-hidden="true"
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData(MERMAID_DRAG_TYPE, String(index))
          event.dataTransfer.setData('text/plain', String(index))
        }}
      >⠿</span>
      {children}
    </div>
  )
}

function mermaidErrorMessage(error) {
  const detail = String(error?.str ?? error?.message ?? '')
  const line = detail.match(/(?:line|línea)\s+(\d+)/i)?.[1]
  return line
    ? `Mermaid no puede interpretar la línea ${line}. Revisa flechas, corchetes y comillas.`
    : 'Mermaid no puede interpretar este diagrama. Revisa flechas, corchetes y comillas.'
}

function BuilderListActions({ label, index, length, minimum, onMove, onRemove }) {
  const moveAndRefocus = (movement, event) => {
    const list = event.currentTarget.closest('.builder-list')
    const targetIndex = index + movement
    onMove(movement)
    window.requestAnimationFrame(() => {
      const rows = list?.querySelectorAll('.mermaid-sortable-row') ?? []
      rows[targetIndex]?.querySelector('input, select, textarea, button:not(:disabled)')?.focus()
    })
  }

  return (
    <div className="builder-list-actions">
      <button type="button" disabled={index === 0} aria-label={`Subir ${label}`} onClick={(event) => moveAndRefocus(-1, event)}>Subir</button>
      <button type="button" disabled={index === length - 1} aria-label={`Bajar ${label}`} onClick={(event) => moveAndRefocus(1, event)}>Bajar</button>
      <button type="button" disabled={length <= minimum} aria-label={`Eliminar ${label}`} onClick={onRemove}><TrashIcon /></button>
    </div>
  )
}

function FlowchartFields({ spec, onChange }) {
  const steps = Array.isArray(spec.steps) ? spec.steps : []
  const updateSteps = (nextSteps) => onChange({ ...spec, steps: nextSteps })
  return (
    <fieldset className="mermaid-template-fields">
      <legend><SectionLegend number="2">Configura el flujo</SectionLegend></legend>
      <label>
        <span>Dirección</span>
        <select value={spec.direction === 'LR' ? 'LR' : 'TD'} onChange={(event) => onChange({ ...spec, direction: event.target.value })}>
          <option value="TD">Vertical</option>
          <option value="LR">Horizontal</option>
        </select>
      </label>
      <div className="builder-list" aria-label="Pasos del flujo">
        {steps.map((step, index) => {
          const value = typeof step === 'object' ? step?.label ?? '' : step
          const label = `paso ${index + 1}`
          return (
            <MermaidSortableRow
              className="builder-list-row"
              index={index}
              label={`Paso ${index + 1}`}
              key={index}
              onReorder={(fromIndex, toIndex) => updateSteps(reorderMermaidItems(steps, fromIndex, toIndex))}
            >
              <div className="mermaid-sortable-body">
                <strong className="mermaid-item-number">Paso {index + 1}</strong>
                <label>
                  <span>Nombre</span>
                  <input
                    data-mermaid-flow-step={index}
                    maxLength={MERMAID_LIMITS.labelLength}
                    value={value}
                    onChange={(event) => updateSteps(replaceAt(steps, index, event.target.value))}
                  />
                </label>
              </div>
              <BuilderListActions
                label={label}
                index={index}
                length={steps.length}
                minimum={MERMAID_LIMITS.flowchartSteps.min}
                onMove={(movement) => updateSteps(reorderMermaidItems(steps, index, index + movement))}
                onRemove={() => updateSteps(steps.filter((_, itemIndex) => itemIndex !== index))}
              />
            </MermaidSortableRow>
          )
        })}
      </div>
      <button
        className="builder-add-row"
        type="button"
        disabled={steps.length >= MERMAID_LIMITS.flowchartSteps.max}
        onClick={() => updateSteps([...steps, `Paso ${steps.length + 1}`])}
      ><PlusIcon /> Añadir paso</button>
    </fieldset>
  )
}

function SequenceFields({ spec, onChange }) {
  const participants = Array.isArray(spec.participants) ? spec.participants : []
  const messages = Array.isArray(spec.messages) ? spec.messages : []
  const participantLabel = (participant) => typeof participant === 'object' ? participant?.label ?? '' : participant
  const updateParticipants = (nextParticipants) => onChange({ ...spec, participants: nextParticipants })
  const updateMessages = (nextMessages) => onChange({ ...spec, messages: nextMessages })

  const removeParticipant = (removedIndex) => {
    const nextParticipants = participants.filter((_, index) => index !== removedIndex)
    const nextMessages = messages
      .filter((message) => Number(message.from) !== removedIndex && Number(message.to) !== removedIndex)
      .map((message) => ({
        ...message,
        from: Number(message.from) > removedIndex ? Number(message.from) - 1 : Number(message.from),
        to: Number(message.to) > removedIndex ? Number(message.to) - 1 : Number(message.to),
      }))
    onChange({ ...spec, participants: nextParticipants, messages: nextMessages })
  }

  return (
    <fieldset className="mermaid-template-fields">
      <legend><SectionLegend number="2">Configura la secuencia</SectionLegend></legend>
      <section className="builder-nested-section" aria-label="Participantes">
        <h4>Participantes</h4>
        <div className="builder-list">
          {participants.map((participant, index) => (
            <div className="builder-list-row" role="group" aria-label={`Participante ${index + 1}`} key={index}>
              <label>
                <span>Participante {index + 1}</span>
                <input
                  maxLength={MERMAID_LIMITS.labelLength}
                  value={participantLabel(participant)}
                  onChange={(event) => updateParticipants(replaceAt(participants, index, event.target.value))}
                />
              </label>
              <button
                type="button"
                disabled={participants.length <= MERMAID_LIMITS.participants.min}
                aria-label={`Eliminar participante ${index + 1}`}
                onClick={() => removeParticipant(index)}
              ><TrashIcon /></button>
            </div>
          ))}
        </div>
        <button
          className="builder-add-row"
          type="button"
          disabled={participants.length >= MERMAID_LIMITS.participants.max}
          onClick={() => updateParticipants([...participants, `Participante ${participants.length + 1}`])}
        ><PlusIcon /> Añadir participante</button>
      </section>

      <section className="builder-nested-section" aria-label="Mensajes">
        <h4>Mensajes</h4>
        <div className="builder-list">
          {messages.map((message, index) => (
            <MermaidSortableRow
              className="builder-message-row"
              index={index}
              label={`Mensaje ${index + 1}`}
              key={index}
              onReorder={(fromIndex, toIndex) => updateMessages(reorderMermaidItems(messages, fromIndex, toIndex))}
            >
              <div className="mermaid-sortable-body">
                <strong className="mermaid-item-number">Mensaje {index + 1}</strong>
                <div className="mermaid-message-fields">
                  <label>
                    <span>Origen</span>
                    <select value={message.from} onChange={(event) => updateMessages(replaceAt(messages, index, { ...message, from: Number(event.target.value) }))}>
                      {participants.map((participant, participantIndex) => <option value={participantIndex} key={participantIndex}>{participantLabel(participant) || `Participante ${participantIndex + 1}`}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Destino</span>
                    <select value={message.to} onChange={(event) => updateMessages(replaceAt(messages, index, { ...message, to: Number(event.target.value) }))}>
                      {participants.map((participant, participantIndex) => <option value={participantIndex} key={participantIndex}>{participantLabel(participant) || `Participante ${participantIndex + 1}`}</option>)}
                    </select>
                  </label>
                  <label className="builder-message-text">
                    <span>Texto</span>
                    <input maxLength={MERMAID_LIMITS.labelLength} value={message.text ?? ''} onChange={(event) => updateMessages(replaceAt(messages, index, { ...message, text: event.target.value }))} />
                  </label>
                  <label>
                    <span>Tipo</span>
                    <select value={message.kind === 'reply' ? 'reply' : 'message'} onChange={(event) => updateMessages(replaceAt(messages, index, { ...message, kind: event.target.value }))}>
                      <option value="message">Mensaje</option>
                      <option value="reply">Respuesta</option>
                    </select>
                  </label>
                </div>
              </div>
              <BuilderListActions
                label={`mensaje ${index + 1}`}
                index={index}
                length={messages.length}
                minimum={MERMAID_LIMITS.messages.min}
                onMove={(movement) => updateMessages(reorderMermaidItems(messages, index, index + movement))}
                onRemove={() => updateMessages(messages.filter((_, messageIndex) => messageIndex !== index))}
              />
            </MermaidSortableRow>
          ))}
        </div>
        <button
          className="builder-add-row"
          type="button"
          disabled={messages.length >= MERMAID_LIMITS.messages.max || participants.length < 2}
          onClick={() => updateMessages([...messages, { from: 0, to: 1, text: `Mensaje ${messages.length + 1}`, kind: 'message' }])}
        ><PlusIcon /> Añadir mensaje</button>
      </section>
    </fieldset>
  )
}

function TimelineFields({ spec, onChange }) {
  const events = Array.isArray(spec.events) ? spec.events : []
  const updateEvents = (nextEvents) => onChange({ ...spec, events: nextEvents })
  return (
    <fieldset className="mermaid-template-fields">
      <legend><SectionLegend number="2">Configura la cronología</SectionLegend></legend>
      <label>
        <span>Título</span>
        <input maxLength={MERMAID_LIMITS.labelLength} value={spec.title ?? ''} onChange={(event) => onChange({ ...spec, title: event.target.value })} />
      </label>
      <div className="builder-list" aria-label="Eventos de la cronología">
        {events.map((event, index) => (
          <MermaidSortableRow
            className="builder-event-row"
            index={index}
            label={`Evento ${index + 1}`}
            key={index}
            onReorder={(fromIndex, toIndex) => updateEvents(reorderMermaidItems(events, fromIndex, toIndex))}
          >
            <div className="mermaid-sortable-body">
              <strong className="mermaid-item-number">Evento {index + 1}</strong>
              <div className="mermaid-event-fields">
                <label>
                  <span>Etapa o fecha</span>
                  <input maxLength={MERMAID_LIMITS.labelLength} value={event.period ?? ''} onChange={(inputEvent) => updateEvents(replaceAt(events, index, { ...event, period: inputEvent.target.value }))} />
                </label>
                <label>
                  <span>Descripción</span>
                  <input maxLength={MERMAID_LIMITS.labelLength} value={event.text ?? ''} onChange={(inputEvent) => updateEvents(replaceAt(events, index, { ...event, text: inputEvent.target.value }))} />
                </label>
              </div>
            </div>
            <BuilderListActions
              label={`evento ${index + 1}`}
              index={index}
              length={events.length}
              minimum={MERMAID_LIMITS.timelineEvents.min}
              onMove={(movement) => updateEvents(reorderMermaidItems(events, index, index + movement))}
              onRemove={() => updateEvents(events.filter((_, eventIndex) => eventIndex !== index))}
            />
          </MermaidSortableRow>
        ))}
      </div>
      <button
        className="builder-add-row"
        type="button"
        disabled={events.length >= MERMAID_LIMITS.timelineEvents.max}
        onClick={() => updateEvents([...events, { period: `Etapa ${events.length + 1}`, text: 'Descripción' }])}
      ><PlusIcon /> Añadir evento</button>
    </fieldset>
  )
}

function PieFields({ spec, onChange }) {
  const slices = Array.isArray(spec.slices) ? spec.slices : []
  const updateSlices = (nextSlices) => onChange({ ...spec, slices: nextSlices })
  return (
    <fieldset className="mermaid-template-fields">
      <legend><SectionLegend number="2">Configura el gráfico circular</SectionLegend></legend>
      <label>
        <span>Título</span>
        <input maxLength={MERMAID_LIMITS.labelLength} value={spec.title ?? ''} onChange={(event) => onChange({ ...spec, title: event.target.value })} />
      </label>
      <label className="builder-checkbox">
        <input type="checkbox" checked={spec.showData !== false} onChange={(event) => onChange({ ...spec, showData: event.target.checked })} />
        <span>Mostrar valores en el gráfico</span>
      </label>
      <div className="builder-list" aria-label="Categorías del gráfico">
        {slices.map((slice, index) => (
          <MermaidSortableRow
            className="builder-event-row"
            index={index}
            label={`Categoría ${index + 1}`}
            key={index}
            onReorder={(fromIndex, toIndex) => updateSlices(reorderMermaidItems(slices, fromIndex, toIndex))}
          >
            <div className="mermaid-sortable-body">
              <strong className="mermaid-item-number">Categoría {index + 1}</strong>
              <div className="mermaid-event-fields">
                <label>
                  <span>Nombre</span>
                  <input maxLength={MERMAID_LIMITS.labelLength} value={slice.label ?? ''} onChange={(event) => updateSlices(replaceAt(slices, index, { ...slice, label: event.target.value }))} />
                </label>
                <label>
                  <span>Valor</span>
                  <input type="number" min="0.01" max="1000000000" step="any" value={slice.value ?? ''} onChange={(event) => updateSlices(replaceAt(slices, index, { ...slice, value: event.target.value }))} />
                </label>
              </div>
            </div>
            <BuilderListActions
              label={`categoría ${index + 1}`}
              index={index}
              length={slices.length}
              minimum={MERMAID_LIMITS.pieSlices.min}
              onMove={(movement) => updateSlices(reorderMermaidItems(slices, index, index + movement))}
              onRemove={() => updateSlices(slices.filter((_, sliceIndex) => sliceIndex !== index))}
            />
          </MermaidSortableRow>
        ))}
      </div>
      <button
        className="builder-add-row"
        type="button"
        disabled={slices.length >= MERMAID_LIMITS.pieSlices.max}
        onClick={() => updateSlices([...slices, { label: `Categoría ${slices.length + 1}`, value: 10 }])}
      ><PlusIcon /> Añadir categoría</button>
    </fieldset>
  )
}

function MermaidDiagramPreview({ source, flowchartStepCount = 0, onStepSelect, onValidationChange }) {
  const deferredSource = useDeferredValue(source)
  const previewRef = useRef(null)
  const [state, setState] = useState({ status: 'loading', svg: '', error: '' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading', svg: '', error: '' })
    onValidationChange?.({ source: deferredSource, status: 'loading' })
    const render = async () => {
      try {
        const mermaid = await loadMermaid()
        mermaidPreviewSequence += 1
        const { svg } = await mermaid.render(`linea-builder-preview-${mermaidPreviewSequence}`, deferredSource)
        if (!cancelled) {
          setState({ status: 'ready', svg, error: '' })
          onValidationChange?.({ source: deferredSource, status: 'ready' })
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', svg: '', error: mermaidErrorMessage(error) })
          onValidationChange?.({ source: deferredSource, status: 'error' })
        }
      }
    }
    render()
    return () => { cancelled = true }
  }, [deferredSource, onValidationChange])

  useEffect(() => {
    if (state.status !== 'ready' || flowchartStepCount < 1) return
    const nodes = previewRef.current?.querySelectorAll('.node') ?? []
    nodes.forEach((node) => {
      const stepIndex = getMermaidFlowchartStepIndex(node.id, flowchartStepCount)
      if (stepIndex === null) return
      node.dataset.mermaidFlowStep = String(stepIndex)
      node.setAttribute('role', 'button')
      node.setAttribute('tabindex', '0')
      node.setAttribute('focusable', 'true')
      node.setAttribute('aria-label', `Editar paso ${stepIndex + 1}`)
    })
  })

  const selectStepFromEvent = (event) => {
    const node = event.target.closest?.('.node')
    if (!node) return
    const storedIndex = Number(node.dataset.mermaidFlowStep)
    const stepIndex = Number.isInteger(storedIndex)
      ? storedIndex
      : getMermaidFlowchartStepIndex(node.id, flowchartStepCount)
    if (stepIndex !== null) onStepSelect?.(stepIndex)
  }

  if (state.status === 'loading') return <div className="mermaid-builder-preview is-loading" role="status">Dibujando vista previa…</div>
  if (state.status === 'error') return <div className="mermaid-builder-preview has-error" role="alert">{state.error}</div>
  return (
    <div
      ref={previewRef}
      className="mermaid-builder-preview is-ready"
      role={flowchartStepCount > 0 ? 'group' : 'img'}
      aria-label={flowchartStepCount > 0 ? 'Vista previa interactiva del diagrama' : 'Vista previa del diagrama'}
      onClick={selectStepFromEvent}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (!event.target.closest?.('.node')) return
        event.preventDefault()
        selectStepFromEvent(event)
      }}
      dangerouslySetInnerHTML={{ __html: state.svg }}
    />
  )
}

function mergeWithDefaults(spec) {
  const type = TEMPLATE_TYPES.has(spec?.type) ? spec.type : 'flowchart'
  const defaults = getDefaultMermaidSpec(type)
  const merged = { ...defaults, ...spec, type }
  if (type === 'flowchart') merged.steps = Array.isArray(spec?.steps) ? spec.steps : defaults.steps
  if (type === 'sequence') {
    merged.participants = Array.isArray(spec?.participants) ? spec.participants : defaults.participants
    merged.messages = Array.isArray(spec?.messages) ? spec.messages : defaults.messages
  }
  if (type === 'timeline') merged.events = Array.isArray(spec?.events) ? spec.events : defaults.events
  if (type === 'pie') merged.slices = Array.isArray(spec?.slices) ? spec.slices : defaults.slices
  return merged
}

export default function MermaidBuilderDialog({
  spec = getDefaultMermaidSpec('flowchart'),
  source = '',
  editing = false,
  onChange,
  onSourceChange,
  onConfirm,
  onCancel,
  onRestoreFocus,
}) {
  const titleId = useId()
  const descriptionId = useId()
  const templateName = useId()
  const formRef = useRef(null)
  const [editingMode, setEditingMode] = useState(source ? 'code' : 'assistant')
  const [previewValidation, setPreviewValidation] = useState({ source: '', status: 'loading' })
  const handleValidationChange = useCallback((nextValidation) => setPreviewValidation(nextValidation), [])
  const currentSpec = useMemo(() => mergeWithDefaults(spec), [spec])
  const generated = useMemo(() => {
    try {
      return { source: createMermaidSource(currentSpec), error: '' }
    } catch (error) {
      return { source: '', error: error instanceof Error ? error.message : 'La configuración no es válida.' }
    }
  }, [currentSpec])
  const rawSource = String(source ?? '')
  const activeSource = editingMode === 'code' ? rawSource.trim() : generated.source
  const activeError = editingMode === 'code'
    ? (!activeSource ? 'Escribe el código Mermaid del diagrama.' : '')
    : generated.error
  const previewIsCurrent = previewValidation.source === activeSource
  const previewPending = !activeError && (!previewIsCurrent || previewValidation.status === 'loading')
  const previewInvalid = previewIsCurrent && previewValidation.status === 'error'
  const submitDisabled = Boolean(activeError) || previewPending || previewInvalid

  const handlePreviewStepSelect = useCallback((stepIndex) => {
    const input = formRef.current?.querySelector(`[data-mermaid-flow-step="${stepIndex}"]`)
    if (!input) return
    input.focus({ preventScroll: true })
    input.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const resetExample = () => {
    const nextSpec = getDefaultMermaidSpec(currentSpec.type)
    onChange(nextSpec)
    onSourceChange?.(createMermaidSource(nextSpec))
  }

  const Fields = currentSpec.type === 'flowchart'
    ? FlowchartFields
    : currentSpec.type === 'sequence'
      ? SequenceFields
      : currentSpec.type === 'timeline'
        ? TimelineFields
        : PieFields

  return (
    <BuilderDialogFrame className="mermaid-builder-dialog" titleId={titleId} descriptionId={descriptionId} onCancel={onCancel} onRestoreFocus={onRestoreFocus}>
      <form
        ref={formRef}
        className="builder-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!submitDisabled) onConfirm(currentSpec, activeSource)
        }}
      >
        <header className="builder-dialog-header">
          <DiagramIcon />
          <div>
            <h2 id={titleId}>{editing ? 'Editar diagrama' : 'Crear diagrama'}</h2>
            <p id={descriptionId}>Elige una plantilla y completa sus datos. Línea genera Mermaid por ti.</p>
          </div>
          <button type="button" aria-label="Cerrar el creador de diagramas" onClick={onCancel}><CloseIcon /></button>
        </header>

        <div className="mermaid-edit-mode" role="group" aria-label="Forma de crear el diagrama">
          <button type="button" className={editingMode === 'assistant' ? 'is-active' : ''} aria-pressed={editingMode === 'assistant'} onClick={() => setEditingMode('assistant')}>Asistente</button>
          <button
            type="button"
            className={editingMode === 'code' ? 'is-active' : ''}
            aria-pressed={editingMode === 'code'}
            onClick={() => {
              if (!rawSource.trim() && generated.source) onSourceChange?.(generated.source)
              setEditingMode('code')
            }}
          >Código Mermaid</button>
          <button className="mermaid-reset-example" type="button" onClick={resetExample}>Restablecer ejemplo</button>
        </div>

        {editingMode === 'assistant' ? <fieldset className="mermaid-template-picker">
          <legend><SectionLegend number="1">Elige el tipo de diagrama</SectionLegend></legend>
          <div className="mermaid-template-options">
            {TEMPLATES.map((template, index) => (
              <label className={`mermaid-template-option${currentSpec.type === template.type ? ' is-selected' : ''}`} key={template.type}>
                <input
                  autoFocus={currentSpec.type === template.type}
                  type="radio"
                  name={templateName}
                  value={template.type}
                  checked={currentSpec.type === template.type}
                  onChange={() => onChange(getDefaultMermaidSpec(template.type))}
                />
                <strong>{template.label}</strong>
                <small>{template.description}</small>
              </label>
            ))}
          </div>
        </fieldset> : null}

        <div className="mermaid-builder-content">
          <div className="mermaid-builder-fields">
            {editingMode === 'assistant' ? (
              <Fields spec={currentSpec} onChange={onChange} />
            ) : (
              <label className="mermaid-source-field">
                <span><SectionLegend number="1">Edita el código Mermaid</SectionLegend></span>
                <textarea
                  autoFocus
                  value={rawSource}
                  spellCheck="false"
                  aria-describedby={`${titleId}-source-help`}
                  onChange={(event) => onSourceChange?.(event.target.value)}
                />
                <small id={`${titleId}-source-help`}>Puedes editar cualquier sintaxis Mermaid compatible. La vista se actualiza a la derecha.</small>
              </label>
            )}
          </div>
          <aside className="mermaid-builder-output" aria-labelledby={`${titleId}-preview`}>
            <h3 id={`${titleId}-preview`}><SectionLegend number={editingMode === 'assistant' ? '3' : '2'}>Revisa la vista previa</SectionLegend></h3>
            {activeError
              ? <div className="builder-validation-error" role="alert">{activeError}</div>
              : <MermaidDiagramPreview
                  source={activeSource}
                  flowchartStepCount={editingMode === 'assistant' && currentSpec.type === 'flowchart' ? currentSpec.steps.length : 0}
                  onStepSelect={handlePreviewStepSelect}
                  onValidationChange={handleValidationChange}
                />}
            {editingMode === 'assistant' && currentSpec.type === 'flowchart' && !activeError
              ? <p className="mermaid-preview-help">Selecciona un nodo para editar directamente ese paso.</p>
              : null}
            <details className="mermaid-generated-source">
              <summary>{editingMode === 'assistant' ? 'Ver código generado' : 'Ver código actual'}</summary>
              <pre><code>{activeSource}</code></pre>
            </details>
          </aside>
        </div>

        <footer className="builder-dialog-actions">
          <button type="button" onClick={onCancel}>Cancelar</button>
          <button className="primary" type="submit" disabled={submitDisabled}>{editing ? 'Guardar diagrama' : 'Insertar diagrama'}</button>
        </footer>
      </form>
    </BuilderDialogFrame>
  )
}
