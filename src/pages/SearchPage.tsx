import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BrandList } from '../components/BrandList'
import { CategoryTabs } from '../components/CategoryTabs'
import { FilterChips } from '../components/FilterChips'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import type { Scope } from '../api/types'
import { CATEGORIES, isCategoryId } from '../lib/categories'
import { PAGE_SIZE } from '../lib/paginate'
import { applyFilters, coreFields, isArchived } from '../lib/schema'
import type { Filters } from '../lib/schema'
import { buildIndex, runSearch } from '../lib/search'
import { useBrands } from '../store/BrandsContext'
import { useSearchState } from '../store/SearchState'

export function SearchPage() {
  const { category } = useParams()
  const scope: Scope = isCategoryId(category) ? category : 'all'

  const { data, status, stale, error, reload } = useBrands()
  // Состояние поиска живёт выше страницы и переживает уход в карточку бренда.
  const { state, patch } = useSearchState()
  const { query, filters, showArchived, page } = state

  // Фильтры привязаны к колонкам, а колонки у категорий разные: чип «Обувь»,
  // оставшийся от «Моды», в «Красоте» не совпал бы ни с одной строкой и молча
  // обнулил бы выдачу. Запрос при этом сохраняем — искать дальше внутри
  // категории удобно.
  //
  // Сравниваем с сохранённой категорией, а не вешаем сброс на монтирование:
  // возврат из карточки — это тоже монтирование, и фильтры бы слетали.
  useEffect(() => {
    if (state.scope !== scope) patch({ scope, filters: {}, page: 1 })
  }, [scope, state.scope, patch])

  // Любое сужение выдачи возвращает на первую страницу: остаться на седьмой,
  // когда результатов стало три, нельзя. Сброс идёт вместе с самой правкой,
  // а не отдельным эффектом, иначе возврат из карточки терял бы номер страницы.
  const setQuery = (value: string) => patch({ query: value, page: 1 })
  const setFilters = (value: Filters) => patch({ filters: value, page: 1 })
  const setShowArchived = (value: boolean) => patch({ showArchived: value, page: 1 })

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

  // База могла обновиться в фоне и стать короче открытой страницы.
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

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

      <FilterChips fields={fields} filters={filters} onChange={setFilters} />

      <div className="toolbar">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          <span>Показывать архив</span>
        </label>
        <Link className="btn btn--primary btn--small" to={scope === 'all' ? '/new' : `/new/${scope}`}>
          Добавить бренд
        </Link>
      </div>

      <BrandList rows={pageRows} fields={fields} showCategory={scope === 'all'} />

      <Pagination
        page={safePage}
        pageCount={pageCount}
        onChange={(next) => {
          patch({ page: next })
          // Иначе человек оказывается в середине новой страницы.
          window.scrollTo({ top: 0 })
        }}
      />
    </>
  )
}
