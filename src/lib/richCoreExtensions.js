import {
  Table,
  TableCell,
  TableHeader,
  TableKit,
  renderTableToMarkdown,
} from '@tiptap/extension-table'
import HorizontalRule from '@tiptap/extension-horizontal-rule'

const TABLE_BLOCK_SEPARATOR = '<br>'

function escapeTableCellMarkdown(value) {
  return String(value ?? '')
    .replaceAll('\u001f', TABLE_BLOCK_SEPARATOR)
    .replace(/(?<!\\)\|/g, '\\|')
}

const RichTable = Table.extend({
  renderMarkdown(node, helpers) {
    const safeHelpers = {
      ...helpers,
      renderChildren(content) {
        return escapeTableCellMarkdown(helpers.renderChildren(content))
      },
    }
    return renderTableToMarkdown(node, safeHelpers, { cellLineSeparator: TABLE_BLOCK_SEPARATOR })
  },
})

const RichTableCell = TableCell.extend({
  content: 'paragraph',
})

const RichTableHeader = TableHeader.extend({
  content: 'paragraph',
})

const RichHorizontalRule = HorizontalRule.extend({
  addCommands() {
    const parentCommands = this.parent?.() ?? {}
    return {
      ...parentCommands,
      setHorizontalRule: () => (props) => {
        const { $from, $to } = props.state.selection
        const positions = [$from, $to]
        const insideTable = positions.some(($position) => {
          for (let depth = $position.depth; depth > 0; depth -= 1) {
            if ($position.node(depth).type.name === 'table') return true
          }
          return false
        })
        if (insideTable) return false
        return parentCommands.setHorizontalRule?.()(props) ?? false
      },
    }
  },

  addInputRules() {
    return []
  },
})

export function richCoreExtensions() {
  return [
    RichHorizontalRule,
    TableKit.configure({ table: false, tableCell: false, tableHeader: false }),
    RichTable.configure({ resizable: false }),
    RichTableCell,
    RichTableHeader,
  ]
}
