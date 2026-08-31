import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandList } from '../components/BrandList'
import { FilterChips } from '../components/FilterChips'
import { SearchBar } from '../components/SearchBar'
import { applyFilters, filterableFields, isArchived } from '../lib/schema'
import type { Filters } from '../lib/schema'
import { buildIndex, runSearch } from '../lib/search'
import { useBrands } from '../store/BrandsContext'

export function SearchPage() {
  const { data, status, stale, error, reload } = useBrands()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>({})
  const [showArchived, setShowArchived] = useState(false)

  const visibleRows = useMemo(
    () => (data ? data.rows.filter((row) => showArchived || !isArchived(row)) : []),
    [data, showArchived],
  )

  // Индекс перестраивается только при смене данных, не на каждое нажатие клавиши.
  const index = useMemo(
    () => (data ? buildIndex(data.fields, visibleRows) : null),
    [data, visibleRows],
  )

  const results = useMemo(() => {
    if (!data || !index) return []
    return applyFilters(runSearch(index, query), filters, data.fields)
  }, [data, index, query, filters])

  if (status === 'loading') return <p className="empty">Загружаем базу…</p>

  if (status === 'error') {
    return (
      <div className="empty">
        <p>Не удалось загрузить базу.</p>
        <p className="muted">{error}</p>
        <button className="btn btn--primary" onClick={() => void reload()}>
          Попробовать ещё раз
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <>
      {error && (
        <p className="banner banner--warn">
          Показаны сохранённые данные — обновить не удалось ({error}). Правки сейчас не сохранятся.
        </p>
      )}
      {!error && stale && <p className="banner">Проверяем, нет ли изменений в таблице…</p>}

      <SearchBar value={query} onChange={setQuery} total={visibleRows.length} found={results.length} />

      <FilterChips
        fields={filterableFields(data.fields)}
        rows={visibleRows}
        filters={filters}
        onChange={setFilters}
      />

      <div className="toolbar">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          <span>Показывать архив</span>
        </label>
        <Link className="btn btn--primary" to="/new">
          Добавить бренд
        </Link>
      </div>

      <BrandList rows={results} fields={data.fields} />
    </>
  )
}
