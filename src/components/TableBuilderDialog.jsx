import { useId, useRef, useState } from 'react'
import { CloseIcon, TableIcon } from './Icons.jsx'
import BuilderDialogFrame from './BuilderDialogFrame.jsx'
import { TABLE_LIMITS, createTableMarkdown } from '../lib/advancedBuilders.js'

const GRID_COLUMNS = 6
const GRID_BODY_ROWS = 5
const GRID_ROWS = Array.from({ length: GRID_BODY_ROWS }, (_, index) => index + 1)
const GRID_CELLS = Array.from({ length: GRID_COLUMNS }, (_, index) => index + 1)

function safeCount(value, fallback, limits) {
  const number = Number(value)
  if (!Number.isInteger(number)) return fallback
  return Math.min(limits.max, Math.max(limits.min, number))
}

function resizeHeaders(headers, columns) {
  return Array.from({ length: columns }, (_, index) => headers?.[index] ?? `Columna ${index + 1}`)
}

export default function TableBuilderDialog({ spec = {}, onChange, onConfirm, onCancel, onRestoreFocus }) {
  const titleId = useId()
  const descriptionId = useId()
  const sizeLabelId = useId()
  const gridRef = useRef(null)
  const [hoveredSize, setHoveredSize] = useState(null)
  const columns = safeCount(spec.columns, 3, TABLE_LIMITS.columns)
  const bodyRows = safeCount(spec.bodyRows, 2, TABLE_LIMITS.bodyRows)
  const headers = resizeHeaders(spec.headers, columns)
  const currentSpec = { ...spec, columns, bodyRows, headers }
  const displaySize = hoveredSize ?? { columns, bodyRows }
  const generatedMarkdown = createTableMarkdown(currentSpec)

  const updateSize = (nextColumns, nextBodyRows) => {
    const normalizedColumns = safeCount(nextColumns, columns, TABLE_LIMITS.columns)
    const normalizedRows = safeCount(nextBodyRows, bodyRows, TABLE_LIMITS.bodyRows)
    onChange({
      ...spec,
      columns: normalizedColumns,
      bodyRows: normalizedRows,
      headers: resizeHeaders(headers, normalizedColumns),
    })
  }

  const updateHeader = (index, value) => {
    const nextHeaders = [...headers]
    nextHeaders[index] = value
    onChange({ ...spec, columns, bodyRows, headers: nextHeaders })
  }

  const focusGridCell = (nextColumns, nextRows) => {
    gridRef.current
      ?.querySelector(`[data-columns="${nextColumns}"][data-rows="${nextRows}"]`)
      ?.focus()
  }

  const navigateGrid = (event, gridColumns, gridRows) => {
    const moves = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const nextColumns = Math.min(GRID_COLUMNS, Math.max(1, gridColumns + move[0]))
    const nextRows = Math.min(GRID_BODY_ROWS, Math.max(1, gridRows + move[1]))
    setHoveredSize({ columns: nextColumns, bodyRows: nextRows })
    focusGridCell(nextColumns, nextRows)
  }

  const gridTabColumns = Math.min(columns, GRID_COLUMNS)
  const gridTabRows = Math.min(bodyRows, GRID_BODY_ROWS)
  const previewRows = Math.min(bodyRows, 3)

  return (
    <BuilderDialogFrame className="table-builder-dialog" titleId={titleId} descriptionId={descriptionId} onCancel={onCancel} onRestoreFocus={onRestoreFocus}>
      <form
        className="builder-form"
        onSubmit={(event) => {
          event.preventDefault()
          onConfirm(currentSpec, generatedMarkdown)
        }}
      >
        <header className="builder-dialog-header">
          <TableIcon />
          <div>
            <h2 id={titleId}>Insertar tabla</h2>
            <p id={descriptionId}>Elige el tamaño y escribe los nombres de la cabecera.</p>
          </div>
          <button type="button" aria-label="Cerrar el creador de tablas" onClick={onCancel}><CloseIcon /></button>
        </header>

        <div className="table-builder-content">
          <section className="table-size-section" aria-labelledby={sizeLabelId}>
            <h3 id={sizeLabelId}>Tamaño</h3>
            <div
              ref={gridRef}
              className="table-size-grid"
              role="group"
              aria-labelledby={sizeLabelId}
              onMouseLeave={() => setHoveredSize(null)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setHoveredSize(null)
              }}
            >
              {GRID_ROWS.flatMap((row) => GRID_CELLS.map((column) => {
                const withinSelection = column <= displaySize.columns && row <= displaySize.bodyRows
                const selected = column === columns && row === bodyRows
                return (
                  <button
                    key={`${column}-${row}`}
                    className={`table-size-cell${withinSelection ? ' is-within-selection' : ''}${selected ? ' is-selected' : ''}`}
                    type="button"
                    data-columns={column}
                    data-rows={row}
                    aria-label={`${column} ${column === 1 ? 'columna' : 'columnas'} y ${row} ${row === 1 ? 'fila de datos' : 'filas de datos'}`}
                    aria-pressed={selected}
                    tabIndex={column === gridTabColumns && row === gridTabRows ? 0 : -1}
                    autoFocus={column === gridTabColumns && row === gridTabRows}
                    onFocus={() => setHoveredSize({ columns: column, bodyRows: row })}
                    onMouseEnter={() => setHoveredSize({ columns: column, bodyRows: row })}
                    onKeyDown={(event) => navigateGrid(event, column, row)}
                    onClick={() => updateSize(column, row)}
                  />
                )
              }))}
            </div>
            <p className="table-size-summary" aria-live="polite">
              {displaySize.columns} {displaySize.columns === 1 ? 'columna' : 'columnas'} · {displaySize.bodyRows} {displaySize.bodyRows === 1 ? 'fila de datos' : 'filas de datos'}
            </p>
            <div className="table-size-inputs">
              <label>
                <span>Columnas</span>
                <input
                  type="number"
                  min={TABLE_LIMITS.columns.min}
                  max={TABLE_LIMITS.columns.max}
                  value={columns}
                  onChange={(event) => updateSize(event.target.valueAsNumber, bodyRows)}
                />
              </label>
              <label>
                <span>Filas de datos</span>
                <input
                  type="number"
                  min={TABLE_LIMITS.bodyRows.min}
                  max={TABLE_LIMITS.bodyRows.max}
                  value={bodyRows}
                  onChange={(event) => updateSize(columns, event.target.valueAsNumber)}
                />
              </label>
            </div>
            <small>La primera fila se reserva siempre para la cabecera.</small>
          </section>

          <section className="table-headers-section" aria-labelledby={`${titleId}-headers`}>
            <h3 id={`${titleId}-headers`}>Cabeceras</h3>
            <div className="table-header-fields">
              {headers.map((header, index) => (
                <label key={index}>
                  <span>Columna {index + 1}</span>
                  <input
                    value={header}
                    maxLength={120}
                    onChange={(event) => updateHeader(index, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="table-builder-preview" aria-labelledby={`${titleId}-preview`}>
            <h3 id={`${titleId}-preview`}>Vista previa</h3>
            <div className="table-preview-scroll">
              <table>
                <caption className="sr-only">Vista previa de la tabla que se insertará</caption>
                <thead><tr>{headers.map((header, index) => <th key={index} scope="col">{header || `Columna ${index + 1}`}</th>)}</tr></thead>
                <tbody>
                  {Array.from({ length: previewRows }, (_, row) => (
                    <tr key={row}>{headers.map((_, column) => <td key={column}>Dato</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bodyRows > previewRows ? <small>Y {bodyRows - previewRows} filas de datos más.</small> : null}
          </section>
        </div>

        <footer className="builder-dialog-actions">
          <button type="button" onClick={onCancel}>Cancelar</button>
          <button className="primary" type="submit">Insertar tabla</button>
        </footer>
      </form>
    </BuilderDialogFrame>
  )
}
