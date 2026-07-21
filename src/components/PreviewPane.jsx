import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { renderMarkdown } from '../lib/markdown.js'
import { renderMermaidSvg } from '../lib/mermaidRenderer.js'

const PreviewPane = forwardRef(function PreviewPane({ markdown }, forwardedRef) {
  const rendered = useMemo(() => renderMarkdown(markdown, { sourceMap: true }), [markdown])
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

  useImperativeHandle(forwardedRef, () => ({
    scrollToLine(line) {
      const target = articleRef.current?.querySelector(`[data-source-line="${Math.max(1, Number(line) || 1)}"]`)
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      if (!target) return false
      target.classList.add('is-outline-target')
      window.setTimeout(() => target.classList.remove('is-outline-target'), 1200)
      return true
    },
  }), [])

  return (
    <section className="pane preview-pane" aria-labelledby="preview-heading">
      <div className="pane-heading" id="preview-heading">
        <span>Resultado</span>
        <small>Vista renderizada y siempre sincronizada</small>
      </div>
      <article ref={articleRef} className="markdown-preview" dangerouslySetInnerHTML={{ __html: rendered }} />
    </section>
  )
})

export default PreviewPane
