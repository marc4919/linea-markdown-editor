const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const inline = (value) => {
  let html = escapeHtml(value)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>')
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  return html
}

export function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const result = []
  let listType = null
  let inCode = false
  let codeLanguage = ''
  let codeLines = []
  let paragraphLines = []
  let quoteLines = []

  const closeList = () => {
    if (listType) result.push(`</${listType}>`)
    listType = null
  }

  const closeParagraph = () => {
    if (paragraphLines.length) result.push(`<p>${inline(paragraphLines.join(' '))}</p>`)
    paragraphLines = []
  }

  const closeQuote = () => {
    if (quoteLines.length) result.push(`<blockquote><p>${inline(quoteLines.join(' '))}</p></blockquote>`)
    quoteLines = []
  }

  const closeFlow = () => {
    closeParagraph()
    closeQuote()
    closeList()
  }

  const closeCode = () => {
    if (!inCode) return
    const language = codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : ''
    result.push(`<pre><code${language}>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
    codeLines = []
    codeLanguage = ''
    inCode = false
  }

  for (const line of lines) {
    const fence = line.match(/^```\s*([\w-]+)?\s*$/)
    if (fence) {
      closeFlow()
      if (inCode) closeCode()
      else {
        inCode = true
        codeLanguage = fence[1] || ''
      }
      continue
    }

    if (inCode) {
      codeLines.push(line)
      continue
    }

    if (!line.trim()) {
      closeFlow()
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)/)
    if (heading) {
      closeFlow()
      const level = heading[1].length
      result.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      closeFlow()
      result.push('<hr>')
      continue
    }

    const quote = line.match(/^>\s?(.*)/)
    if (quote) {
      closeParagraph()
      closeList()
      quoteLines.push(quote[1])
      continue
    }

    const list = line.match(/^\s*([-+*]|\d+\.)\s+(.+)/)
    if (list) {
      closeParagraph()
      closeQuote()
      const nextType = /\d+\./.test(list[1]) ? 'ol' : 'ul'
      if (listType && listType !== nextType) closeList()
      if (!listType) {
        result.push(`<${nextType}>`)
        listType = nextType
      }
      const task = list[2].match(/^\[([ xX])\]\s+(.+)/)
      if (task) {
        const checked = task[1].toLowerCase() === 'x'
        result.push(`<li class="task-item"><input type="checkbox" disabled${checked ? ' checked' : ''}> <span>${inline(task[2])}</span></li>`)
      } else result.push(`<li>${inline(list[2])}</li>`)
      continue
    }

    closeQuote()
    closeList()
    paragraphLines.push(line.trim())
  }

  closeFlow()
  closeCode()
  return result.join('')
}
