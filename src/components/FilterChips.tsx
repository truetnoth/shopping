import type { BrandRow, FieldDef } from '../api/types'
import { collectOptions, splitFilters } from '../lib/schema'
import type { Filters } from '../lib/schema'

interface Props {
  fields: FieldDef[]
  rows: BrandRow[]
  filters: Filters
  onChange: (filters: Filters) => void
}

export function FilterChips({ fields, rows, filters, onChange }: Props) {
  // Главные фильтры видно сразу, остальные — под раскрывашкой: на экране
  // одновременно нужны категория, «Для кого» и цена, а не восемь групп разом.
  const { primary, extra } = splitFilters(fields)
  if (!primary.length && !extra.length) return null

  const toggle = (column: string, option: string) => {
    const current = filters[column] ?? []
    const next = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option]
    onChange({ ...filters, [column]: next })
  }

  const chipClass = (column: string, option: string) =>
    `chip${(filters[column] ?? []).includes(option) ? ' chip--on' : ''}`

  const countIn = (list: FieldDef[]) =>
    list.reduce((sum, field) => sum + (filters[field.column]?.length ?? 0), 0)

  const extraCount = countIn(extra)
  const activeCount = countIn(primary) + extraCount

  /**
   * Обычное поле даёт свою группу, а все булевы собираются в одну общую —
   * «Особенности». По отдельности они рисовались группой без заголовка и
   * читались как продолжение предыдущего фильтра.
   */
  const groups = (list: FieldDef[]) => {
    const bools = list.filter((field) => field.type === 'bool')

    return (
      <>
        {list
          .filter((field) => field.type !== 'bool')
          .map((field) => {
            const options = collectOptions(field, rows)
            if (options.length < 2) return null

            return (
              <div key={field.column} className="filters__group">
                <span className="filters__label">{field.label}</span>
                <div className="chips">
                  {options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={chipClass(field.column, option)}
                      onClick={() => toggle(field.column, option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

        {bools.length > 0 && (
          <div className="filters__group">
            <span className="filters__label">Особенности</span>
            <div className="chips">
              {bools.map((field) => (
                <button
                  key={field.column}
                  type="button"
                  className={chipClass(field.column, 'Да')}
                  onClick={() => toggle(field.column, 'Да')}
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="filters">
      {groups(primary)}

      {extra.length > 0 && (
        <details className="filters__more">
          {/* Счётчик в заголовке: иначе спрятанный фильтр молча режет выдачу. */}
          <summary>Дополнительные фильтры{extraCount > 0 ? ` (${extraCount})` : ''}</summary>
          <div className="filters filters__nested">{groups(extra)}</div>
        </details>
      )}

      {activeCount > 0 && (
        <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange({})}>
          Сбросить фильтры ({activeCount})
        </button>
      )}
    </div>
  )
}
