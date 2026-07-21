import { CloseIcon, EditIcon, FileIcon, PlusIcon } from './Icons.jsx'

export default function DocumentTabs({ documents, activeId, onActivate, onClose, onNew, onRename }) {
  return (
    <div className="tabs-row">
      <div className="document-tabs" role="tablist" aria-label="Documentos abiertos">
        {documents.map((document) => {
          const active = document.id === activeId
          return (
            <div key={document.id} className={`document-tab${active ? ' is-active' : ''}${document.dirty ? ' is-dirty' : ''}`}>
              <button
                className="tab-main"
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="workspace"
                tabIndex={active ? 0 : -1}
                title={document.filename}
                onClick={() => onActivate(document.id)}
              >
                <FileIcon />
                <span>{document.filename.replace(/\.md$/i, '')}</span>
                {document.dirty ? <i aria-label="Cambios sin exportar" /> : null}
              </button>
              {active ? (
                <button className="tab-rename" type="button" aria-label={`Renombrar ${document.filename}`} title="Renombrar documento" onClick={onRename}>
                  <EditIcon />
                </button>
              ) : null}
              <button className="tab-close" type="button" aria-label={`Cerrar ${document.filename}`} onClick={() => onClose(document.id)}>
                <CloseIcon />
              </button>
            </div>
          )
        })}
      </div>
      <button className="new-tab-button" type="button" aria-label="Nuevo documento" title="Nuevo documento (⌘T)" onClick={onNew}>
        <PlusIcon />
      </button>
    </div>
  )
}
