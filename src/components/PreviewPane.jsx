import { useEffect, useMemo, useRef } from 'react'
import { renderMarkdown } from '../lib/markdown.js'
import { renderMermaidSvg } from '../lib/mermaidRenderer.js'

export default function PreviewPane({ markdown }) {
  const rendered = useMemo(() => renderMarkdown(markdown), [markdown])
  const articleRef = useRef(null)

  useEffect(() => {
    const root = articleRef.current
    const diagrams = [...(root?.querySelectorAll('pre > code.language-mermaid') ?? [])]
    if (!diagrams.length) return undefined

    let cancelled = false
    for (const code of diagrams) code.parentElement?.classList.add('mermaid-block', 'is-rendering')

    const renderDiagrams = async () => {
      for (const code of diagrams) {
        if (cancelled || !code.isConnected) break
        const pre = code.parentElement
        try {
          const { svg } = await renderMermaidSvg(code.textContent ?? '', 'linea-preview')
          if (cancelled || !pre?.isConnected) break
          const container = document.createElement('div')
          container.className = 'mermaid-diagram'
          container.innerHTML = svg
          pre.replaceChildren(container)
          pre.classList.remove('is-rendering')
        } catch {
          if (!pre?.isConnected) continue
          pre.classList.remove('is-rendering')
          pre.classList.add('has-error')
          pre.textContent = 'No se ha podido dibujar este diagrama. Revisa sus datos.'
        }
      }
    }

    renderDiagrams()
    return () => { cancelled = true }
  }, [rendered])

  return (
    <section className="pane preview-pane" aria-labelledby="preview-heading">
      <div className="pane-heading" id="preview-heading">
        <span>Lectura</span>
        <small>Vista limpia y siempre sincronizada</small>
      </div>
      <article ref={articleRef} className="markdown-preview" dangerouslySetInnerHTML={{ __html: rendered }} />
    </section>
  )
}
