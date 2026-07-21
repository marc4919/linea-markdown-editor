let mermaidPromise
let diagramSequence = 0

async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'neutral',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      })
      return mermaid
    })
  }
  return mermaidPromise
}

export async function renderMermaidSvg(source, prefix = 'linea-diagram') {
  const mermaid = await getMermaid()
  diagramSequence += 1
  return mermaid.render(`${prefix}-${diagramSequence}`, String(source ?? ''))
}

export async function validateMermaid(source) {
  const mermaid = await getMermaid()
  return mermaid.parse(String(source ?? ''), { suppressErrors: true })
}
