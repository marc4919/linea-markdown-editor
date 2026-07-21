import { FileIcon } from './Icons.jsx'

export default function DropOverlay({ visible }) {
  if (!visible) return null
  return (
    <div className="drop-overlay" role="status" aria-live="polite">
      <FileIcon />
      <strong>Suelta tus archivos Markdown</strong>
      <span>Se abrirán de forma segura en Línea</span>
    </div>
  )
}
