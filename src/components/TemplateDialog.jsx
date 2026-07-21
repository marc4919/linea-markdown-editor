import { CloseIcon, FileIcon } from './Icons.jsx'

export default function TemplateDialog({ templates, onSelect, onCancel }) {
  return (
    <div className="dialog-backdrop template-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="template-dialog" role="dialog" aria-modal="true" aria-labelledby="template-title">
        <header>
          <div>
            <h2 id="template-title">Crear documento</h2>
            <p>Empieza en blanco o utiliza una estructura preparada.</p>
          </div>
          <button type="button" aria-label="Cerrar plantillas" onClick={onCancel}><CloseIcon /></button>
        </header>
        <div className="template-grid">
          {templates.map((template, index) => (
            <button key={template.id} type="button" autoFocus={index === 0} onClick={() => onSelect(template)}>
              <FileIcon />
              <span>
                <strong>{template.name}</strong>
                <small>{template.description}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
