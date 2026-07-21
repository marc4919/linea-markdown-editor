import { useDeferredValue, useEffect, useMemo, useRef } from 'react'
import { renderMarkdown } from '../lib/markdown.js'

let mermaidInitialized = false
let diagramSequence = 0

export default function PreviewPane({ markdown, onNavigate }) {
  const deferredMarkdown = useDeferredValue(markdown)
  const rendered = useMemo(() => renderMarkdown(deferredMarkdown, { sourceMap: true }), [deferredMarkdown])
  const articleRef = useRef(null)

  useEffect(() => {
    const root = articleRef.current
    const diagrams = [...(root?.querySelectorAll('pre > code.language-mermaid') ?? [])]
    if (!diagrams.length) return undefined

    let cancelled = false
    for (const code of diagrams) code.parentElement?.classList.add('mermaid-block', 'is-rendering')

    const renderDiagrams = async () => {
      try {
        const { default: mermaid } = await import('mermaid')
        if (!mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' })
          mermaidInitialized = true
        }

        for (const code of diagrams) {
          if (cancelled || !code.isConnected) break
          const pre = code.parentElement
          const definition = code.textContent ?? ''
          try {
            diagramSequence += 1
            const { svg, bindFunctions } = await mermaid.render(`linea-diagram-${diagramSequence}`, definition)
            if (cancelled || !pre?.isConnected) break
            const container = document.createElement('div')
            container.className = 'mermaid-diagram'
            container.innerHTML = svg
            pre.replaceChildren(container)
            pre.classList.remove('is-rendering')
            bindFunctions?.(container)
          } catch {
            if (!pre?.isConnected) continue
            pre.classList.remove('is-rendering')
            pre.classList.add('has-error')
            pre.textContent = 'No se ha podido dibujar este diagrama. Revisa la sintaxis Mermaid.'
          }
        }
      } catch {
        for (const code of diagrams) {
          const pre = code.parentElement
          if (!pre?.isConnected) continue
          pre.classList.remove('is-rendering')
          pre.classList.add('has-error')
          pre.textContent = 'El visor de diagramas no está disponible.'
        }
      }
    }

    renderDiagrams()
    return () => { cancelled = true }
  }, [rendered])

  const navigateFromPreview = (event) => {
    if (!onNavigate || event.target.closest('a, button, input, label')) return
    const block = event.target.closest('[data-source-line]')
    if (!block) return
    const line = Number(block.dataset.sourceLine)
    if (Number.isFinite(line)) onNavigate(line)
  }

  return (
    <section className="pane preview-pane" aria-labelledby="preview-heading">
      <div className="pane-heading" id="preview-heading">
        <span>Vista previa</span>
        {onNavigate ? <small>Doble clic para editar en Live</small> : null}
      </div>
      <article ref={articleRef} className="markdown-preview" onDoubleClick={navigateFromPreview} dangerouslySetInnerHTML={{ __html: rendered }} />
    </section>
  )
}
