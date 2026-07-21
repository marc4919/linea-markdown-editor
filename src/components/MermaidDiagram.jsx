import { useEffect, useState } from 'react'
import { renderMermaidSvg } from '../lib/mermaidRenderer.js'

export default function MermaidDiagram({ source, compact = false }) {
  const [state, setState] = useState({ status: 'loading', svg: '', message: '' })

  useEffect(() => {
    let current = true
    setState({ status: 'loading', svg: '', message: '' })

    renderMermaidSvg(source, compact ? 'linea-builder' : 'linea-rich')
      .then(({ svg }) => {
        if (current) setState({ status: 'ready', svg, message: '' })
      })
      .catch(() => {
        if (current) {
          setState({
            status: 'error',
            svg: '',
            message: 'No se puede dibujar todavía. Revisa los datos del diagrama.',
          })
        }
      })

    return () => { current = false }
  }, [compact, source])

  if (state.status === 'loading') {
    return <div className="mermaid-visual is-loading" role="status">Dibujando diagrama…</div>
  }

  if (state.status === 'error') {
    return <div className="mermaid-visual is-error" role="status">{state.message}</div>
  }

  return <div className="mermaid-visual" dangerouslySetInnerHTML={{ __html: state.svg }} />
}
