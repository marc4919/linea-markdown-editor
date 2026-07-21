import { CloseIcon, FileIcon, WarningIcon } from './Icons.jsx'

export function ImportDialog({ files, dirty, onNewTabs, onReplace, onCancel }) {
  if (!files?.length) return null
  const multiple = files.length > 1
  const label = multiple ? `${files.length} archivos` : `«${files[0].name}»`
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="decision-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <button className="dialog-close" type="button" aria-label="Cancelar apertura" onClick={onCancel}><CloseIcon /></button>
        <FileIcon />
        <h2 id="import-title">Abrir {label}</h2>
        <p>{multiple ? 'Cada archivo se abrirá en su propia pestaña.' : 'Elige cómo quieres incorporar el documento.'}</p>
        <div className="dialog-actions">
          <button className="primary" type="button" autoFocus onClick={onNewTabs}>Nueva pestaña{multiple ? 's' : ''}</button>
          {!multiple ? <button type="button" onClick={onReplace}>Reemplazar actual</button> : null}
          <button type="button" onClick={onCancel}>Cancelar</button>
        </div>
        {dirty && !multiple ? <small><WarningIcon /> La pestaña actual contiene cambios sin exportar.</small> : null}
      </section>
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmLabel, destructive = false, onConfirm, onCancel }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <WarningIcon />
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button type="button" autoFocus onClick={onCancel}>Cancelar</button>
          <button className={destructive ? 'destructive' : 'primary'} type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}

export function RenameDialog({ value, onChange, onConfirm, onCancel }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <form className="rename-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title" onSubmit={(event) => { event.preventDefault(); onConfirm() }}>
        <h2 id="rename-title">Renombrar documento</h2>
        <label>
          <span>Nombre del archivo</span>
          <input autoFocus value={value} onChange={(event) => onChange(event.target.value)} />
        </label>
        <div className="confirm-actions">
          <button type="button" onClick={onCancel}>Cancelar</button>
          <button className="primary" type="submit">Guardar nombre</button>
        </div>
      </form>
    </div>
  )
}
