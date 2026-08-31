import type { BrandRow, FieldDef } from '../api/types'
import { collectOptions } from '../lib/schema'
import type { Filters } from '../lib/schema'

interface Props {
  fields: FieldDef[]
  rows: BrandRow[]
  filters: Filters
  onChange: (filters: Filters) => void
}

export function FilterChips({ fields, rows, filters, onChange }: Props) {
  if (!fields.length) return null

  const toggle = (column: string, option: string) => {
    const current = filters[column] ?? []
    const next = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option]
    onChange({ ...filters, [column]: next })
  }

  const activeCount = Object.values(filters).reduce((sum, v) => sum + v.length, 0)

  return (
    <div className="filters">
      {fields.map((field) => {
        // Булево поле — один чип-переключатель, у остальных список значений.
        const isBool = field.type === 'bool'
        const options = isBool ? ['Да'] : collectOptions(field, rows)
        if (!isBool && options.length < 2) return null

        return (
          <div key={field.column} className="filters__group">
            <span className="filters__label">{isBool ? '' : field.label}</span>
            <div className="chips">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`chip${(filters[field.column] ?? []).includes(option) ? ' chip--on' : ''}`}
                  onClick={() => toggle(field.column, option)}
                >
                  {isBool ? field.label : option}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {activeCount > 0 && (
        <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange({})}>
          Сбросить фильтры ({activeCount})
        </button>
      )}
    </div>
  )
}
