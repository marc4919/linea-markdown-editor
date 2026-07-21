import { useCallback, useDeferredValue, useEffect, useId, useMemo, useState } from 'react'
import { CloseIcon, DiagramIcon, PlusIcon, TrashIcon } from './Icons.jsx'
import BuilderDialogFrame from './BuilderDialogFrame.jsx'
import {
  MERMAID_LIMITS,
  createMermaidSource,
  getDefaultMermaidSpec,
} from '../lib/advancedBuilders.js'

const TEMPLATES = [
  { type: 'flowchart', label: 'Flujo', description: 'Pasos conectados en orden' },
  { type: 'sequence', label: 'Secuencia', description: 'Mensajes entre participantes' },
  { type: 'timeline', label: 'Cronología', description: 'Eventos ordenados por etapa o fecha' },
  { type: 'pie', label: 'Circular', description: 'Categorías comparadas por valor' },
]
const TEMPLATE_TYPES = new Set(TEMPLATES.map((template) => template.type))

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

function moveItem(items, index, movement) {
  const destination = index + movement
  if (destination < 0 || destination >= items.length) return items
  const next = [...items]
  ;[next[index], next[destination]] = [next[destination], next[index]]
  return next
}

function BuilderListActions({ label, index, length, minimum, onMove, onRemove }) {
  return (
    <div className="builder-list-actions">
      <button type="button" disabled={index === 0} aria-label={`Subir ${label}`} onClick={() => onMove(-1)}>Subir</button>
      <button type="button" disabled={index === length - 1} aria-label={`Bajar ${label}`} onClick={() => onMove(1)}>Bajar</button>
      <button type="button" disabled={length <= minimum} aria-label={`Eliminar ${label}`} onClick={onRemove}><TrashIcon /></button>
    </div>
  )
}

function FlowchartFields({ spec, onChange }) {
  const steps = Array.isArray(spec.steps) ? spec.steps : []
  const updateSteps = (nextSteps) => onChange({ ...spec, steps: nextSteps })
  return (
    <fieldset className="mermaid-template-fields">
      <legend>Configurar flujo</legend>
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
            <div className="builder-list-row" role="group" aria-label={`Paso ${index + 1}`} key={index}>
              <label>
                <span>Paso {index + 1}</span>
                <input maxLength={MERMAID_LIMITS.labelLength} value={value} onChange={(event) => updateSteps(replaceAt(steps, index, event.target.value))} />
              </label>
              <BuilderListActions
                label={label}
                index={index}
                length={steps.length}
                minimum={MERMAID_LIMITS.flowchartSteps.min}
                onMove={(movement) => updateSteps(moveItem(steps, index, movement))}
                onRemove={() => updateSteps(steps.filter((_, itemIndex) => itemIndex !== index))}
              />
            </div>
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
      <legend>Configurar secuencia</legend>
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
            <div className="builder-message-row" role="group" aria-label={`Mensaje ${index + 1}`} key={index}>
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
              <button
                type="button"
                disabled={messages.length <= MERMAID_LIMITS.messages.min}
                aria-label={`Eliminar mensaje ${index + 1}`}
                onClick={() => updateMessages(messages.filter((_, messageIndex) => messageIndex !== index))}
              ><TrashIcon /></button>
            </div>
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
      <legend>Configurar cronología</legend>
      <label>
        <span>Título</span>
        <input maxLength={MERMAID_LIMITS.labelLength} value={spec.title ?? ''} onChange={(event) => onChange({ ...spec, title: event.target.value })} />
      </label>
      <div className="builder-list" aria-label="Eventos de la cronología">
        {events.map((event, index) => (
          <div className="builder-event-row" role="group" aria-label={`Evento ${index + 1}`} key={index}>
            <label>
              <span>Etapa o fecha</span>
              <input maxLength={MERMAID_LIMITS.labelLength} value={event.period ?? ''} onChange={(inputEvent) => updateEvents(replaceAt(events, index, { ...event, period: inputEvent.target.value }))} />
            </label>
            <label>
              <span>Descripción</span>
              <input maxLength={MERMAID_LIMITS.labelLength} value={event.text ?? ''} onChange={(inputEvent) => updateEvents(replaceAt(events, index, { ...event, text: inputEvent.target.value }))} />
            </label>
            <BuilderListActions
              label={`evento ${index + 1}`}
              index={index}
              length={events.length}
              minimum={MERMAID_LIMITS.timelineEvents.min}
              onMove={(movement) => updateEvents(moveItem(events, index, movement))}
              onRemove={() => updateEvents(events.filter((_, eventIndex) => eventIndex !== index))}
            />
          </div>
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
      <legend>Configurar gráfico circular</legend>
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
          <div className="builder-event-row" role="group" aria-label={`Categoría ${index + 1}`} key={index}>
            <label>
              <span>Categoría</span>
              <input maxLength={MERMAID_LIMITS.labelLength} value={slice.label ?? ''} onChange={(event) => updateSlices(replaceAt(slices, index, { ...slice, label: event.target.value }))} />
            </label>
            <label>
              <span>Valor</span>
              <input type="number" min="0.01" max="1000000000" step="any" value={slice.value ?? ''} onChange={(event) => updateSlices(replaceAt(slices, index, { ...slice, value: event.target.value }))} />
            </label>
            <BuilderListActions
              label={`categoría ${index + 1}`}
              index={index}
              length={slices.length}
              minimum={MERMAID_LIMITS.pieSlices.min}
              onMove={(movement) => updateSlices(moveItem(slices, index, movement))}
              onRemove={() => updateSlices(slices.filter((_, sliceIndex) => sliceIndex !== index))}
            />
          </div>
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

function MermaidDiagramPreview({ source, onValidationChange }) {
  const deferredSource = useDeferredValue(source)
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
      } catch {
        if (!cancelled) {
          setState({ status: 'error', svg: '', error: 'No se ha podido dibujar esta configuración.' })
          onValidationChange?.({ source: deferredSource, status: 'error' })
        }
      }
    }
    render()
    return () => { cancelled = true }
  }, [deferredSource, onValidationChange])

  if (state.status === 'loading') return <div className="mermaid-builder-preview is-loading" role="status">Dibujando vista previa…</div>
  if (state.status === 'error') return <div className="mermaid-builder-preview has-error" role="alert">{state.error}</div>
  return (
    <div
      className="mermaid-builder-preview is-ready"
      role="img"
      aria-label="Vista previa del diagrama"
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
        className="builder-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!submitDisabled) onConfirm(currentSpec, activeSource)
        }}
      >
        <header className="builder-dialog-header">
          <DiagramIcon />
          <div>
            <h2 id={titleId}>Crear diagrama</h2>
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
        </div>

        {editingMode === 'assistant' ? <fieldset className="mermaid-template-picker">
          <legend>Tipo de diagrama</legend>
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
                <span>Código Mermaid</span>
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
            <h3 id={`${titleId}-preview`}>Vista previa</h3>
            {activeError
              ? <div className="builder-validation-error" role="alert">{activeError}</div>
              : <MermaidDiagramPreview source={activeSource} onValidationChange={handleValidationChange} />}
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
