import CodeBlock from '@tiptap/extension-code-block'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import MermaidDiagram from './MermaidDiagram.jsx'

function RichCodeBlockNodeView({ extension, getPos, node }) {
  const language = node.attrs.language || ''
  const isMermaid = language.toLowerCase() === 'mermaid'

  if (isMermaid) {
    const editDiagram = () => {
      extension.options.onEditMermaid?.({
        position: getPos(),
        source: node.textContent,
      })
    }

    return (
      <NodeViewWrapper className="rich-mermaid-block" data-language="mermaid">
        <NodeViewContent as="code" className="rich-mermaid-source" />
        <header contentEditable={false}>
          <span>Diagrama</span>
          <button type="button" onClick={editDiagram}>Editar diagrama</button>
        </header>
        <div contentEditable={false}>
          <MermaidDiagram source={node.textContent} />
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="rich-code-block" data-language={language || undefined}>
      {language ? <span className="rich-code-language" contentEditable={false}>{language}</span> : null}
      <pre><NodeViewContent as="code" /></pre>
    </NodeViewWrapper>
  )
}

const RichCodeBlock = CodeBlock.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      onEditMermaid: null,
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(RichCodeBlockNodeView, { contentDOMElementTag: 'code' })
  },
})

export function createRichCodeBlock(onEditMermaid) {
  return RichCodeBlock.configure({ onEditMermaid })
}
