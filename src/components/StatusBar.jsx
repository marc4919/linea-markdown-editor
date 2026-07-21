export default function StatusBar({ words, cursor, mode }) {
  const showCursor = mode === 'source' || mode === 'split'
  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <span>{words} {words === 1 ? 'palabra' : 'palabras'}</span>
        {showCursor ? <span className="status-cursor">Ln {cursor.line}, Col {cursor.column}</span> : null}
      </div>
    </footer>
  )
}
