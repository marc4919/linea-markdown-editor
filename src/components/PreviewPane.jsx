import { useDeferredValue, useMemo } from 'react'
import { renderMarkdown } from '../lib/markdown.js'

export default function PreviewPane({ markdown }) {
  const deferredMarkdown = useDeferredValue(markdown)
  const rendered = useMemo(() => renderMarkdown(deferredMarkdown), [deferredMarkdown])

  return (
    <section className="pane preview-pane" aria-labelledby="preview-heading">
      <div className="pane-heading" id="preview-heading">Vista previa</div>
      <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: rendered }} />
    </section>
  )
}
