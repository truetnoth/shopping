import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Scope } from '../api/types'
import type { Filters } from '../lib/schema'

/**
 * Состояние экрана поиска живёт выше страницы: уход в карточку бренда
 * размонтирует SearchPage, и отобранные фильтры пропали бы вместе с ней —
 * а редактор обычно правит несколько брендов из одной выборки подряд.
 *
 * Хранится только в памяти вкладки: перезагрузка страницы начинает с чистого
 * листа, выход из системы — тоже, потому что провайдер стоит внутри AuthGate.
 */
export interface SearchState {
  /** Категория, для которой набраны фильтры: у другой колонки уже свои. */
  scope: Scope
  query: string
  filters: Filters
  showArchived: boolean
  page: number
}

const EMPTY: SearchState = {
  scope: 'all',
  query: '',
  filters: {},
  showArchived: false,
  page: 1,
}

interface Store {
  state: SearchState
  patch: (values: Partial<SearchState>) => void
}

const SearchStateContext = createContext<Store | null>(null)

export function SearchStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SearchState>(EMPTY)

  const value = useMemo<Store>(
    () => ({
      state,
      patch: (values) => setState((prev) => ({ ...prev, ...values })),
    }),
    [state],
  )

  return <SearchStateContext.Provider value={value}>{children}</SearchStateContext.Provider>
}

export function useSearchState(): Store {
  const ctx = useContext(SearchStateContext)
  if (!ctx) throw new Error('useSearchState используется вне SearchStateProvider')
  return ctx
}
