import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BrandList } from '../components/BrandList'
import { CategoryTabs } from '../components/CategoryTabs'
import { FilterChips } from '../components/FilterChips'
import { SearchBar } from '../components/SearchBar'
import type { Scope } from '../api/types'
import { CATEGORIES, isCategoryId } from '../lib/categories'
import { applyFilters, coreFields, filterableFields, isArchived } from '../lib/schema'
import type { Filters } from '../lib/schema'
import { buildIndex, runSearch } from '../lib/search'
import { useBrands } from '../store/BrandsContext'

export function SearchPage() {
  const { category } = useParams()
  const scope: Scope = isCategoryId(category) ? category : 'all'

  const { data, status, stale, error, reload } = useBrands()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>({})
  const [showArchived, setShowArchived] = useState(false)

  // Фильтры привязаны к колонкам, а колонки у категорий разные: чип «Обувь»,
  // оставшийся от «Моды», в «Красоте» не совпал бы ни с одной строкой и молча
  // обнулил бы выдачу. Запрос при этом сохраняем — искать дальше внутри
  // категории удобно.
  useEffect(() => setFilters({}), [scope])

  // В режиме «Все» ищем по общему ядру: поля, которые есть во всех трёх схемах.
  // Внутри категории — по её полной схеме, как и раньше.
  const fields = useMemo(() => {
    if (!data) return []
    return scope === 'all'
      ? coreFields(CATEGORIES.map((c) => data.fields[c.id]))
      : data.fields[scope]
  }, [data, scope])

  const scopeRows = useMemo(() => {
    if (!data) return []
    return scope === 'all' ? CATEGORIES.flatMap((c) => data.rows[c.id]) : data.rows[scope]
  }, [data, scope])

  const visibleRows = useMemo(
    () => scopeRows.filter((row) => showArchived || !isArchived(row)),
    [scopeRows, showArchived],
  )

  // Индекс перестраивается только при смене данных, не на каждое нажатие клавиши.
  const index = useMemo(
    () => (fields.length ? buildIndex(fields, visibleRows) : null),
    [fields, visibleRows],
  )

  const results = useMemo(() => {
    if (!index) return []
    return applyFilters(runSearch(index, query), filters, fields)
  }, [index, query, filters, fields])

  const counts = useMemo(() => {
    if (!data) return {}
    const byCategory = Object.fromEntries(
      CATEGORIES.map((c) => [c.id, data.rows[c.id].filter((row) => !isArchived(row)).length]),
    )
    const all = Object.values(byCategory).reduce((sum, n) => sum + n, 0)
    return { ...byCategory, all }
  }, [data])

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
      {!error && stale && <p className="banner">Обновляем базу…</p>}

      <CategoryTabs scope={scope} counts={counts} />

      <SearchBar value={query} onChange={setQuery} total={visibleRows.length} found={results.length} />

      <FilterChips
        fields={filterableFields(fields)}
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
        <Link className="btn btn--primary" to={scope === 'all' ? '/new' : `/new/${scope}`}>
          Добавить бренд
        </Link>
      </div>

      <BrandList rows={results} fields={fields} showCategory={scope === 'all'} />
    </>
  )
}
