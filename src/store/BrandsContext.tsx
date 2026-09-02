import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchDataset } from '../api/client'
import type { BrandRow, CategoryId, Dataset } from '../api/types'
import { useEditorAuth } from '../components/PasswordGate'
import { readCache, writeCache } from '../lib/cache'

type Status = 'loading' | 'ready' | 'error'

interface BrandsState {
  data: Dataset | null
  status: Status
  /** Данные показаны из кэша и ещё обновляются. */
  stale: boolean
  error: string | null
  reload: () => Promise<void>
  applyRow: (category: CategoryId, row: BrandRow) => void
  removeRow: (category: CategoryId, id: string) => void
  getById: (category: CategoryId, id: string) => BrandRow | undefined
}

const BrandsContext = createContext<BrandsState | null>(null)

export function BrandsProvider({ children }: { children: ReactNode }) {
  const { signedIn } = useEditorAuth()
  const [data, setData] = useState<Dataset | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [stale, setStale] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedFor = useRef<boolean | null>(null)

  const load = useCallback(async (cached: Dataset | null) => {
    try {
      const fresh = await fetchDataset()
      setData(fresh)
      writeCache(fresh)
      setStale(false)
      setStatus('ready')
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить базу'
      setError(message)
      // С кэшем на руках остаёмся работоспособными в режиме чтения.
      setStatus(cached ? 'ready' : 'error')
      setStale(Boolean(cached))
    }
  }, [])

  useEffect(() => {
    // Перезагружаемся ровно один раз на каждую смену состояния входа; ref нужен
    // ещё и чтобы StrictMode не тянул базу дважды.
    if (loadedFor.current === signedIn) return
    loadedFor.current = signedIn

    if (!signedIn) {
      setData(null)
      setStatus('loading')
      setStale(false)
      setError(null)
      return
    }

    const cached = readCache()
    if (cached) {
      setData(cached)
      setStatus('ready')
      setStale(true)
    }
    void load(cached)
  }, [signedIn, load])

  const reload = useCallback(async () => {
    setStale(true)
    await load(null)
  }, [load])

  const applyRow = useCallback((category: CategoryId, row: BrandRow) => {
    setData((prev) => {
      if (!prev) return prev
      const rows = [...prev.rows[category]]
      const at = rows.findIndex((r) => r.id === row.id)
      if (at === -1) rows.unshift(row)
      else rows[at] = row

      const next: Dataset = { ...prev, rows: { ...prev.rows, [category]: rows } }
      writeCache(next)
      return next
    })
  }, [])

  const removeRow = useCallback((category: CategoryId, id: string) => {
    setData((prev) => {
      if (!prev) return prev
      const rows = prev.rows[category].filter((row) => row.id !== id)
      const next: Dataset = { ...prev, rows: { ...prev.rows, [category]: rows } }
      writeCache(next)
      return next
    })
  }, [])

  const getById = useCallback(
    (category: CategoryId, id: string) => data?.rows[category]?.find((row) => row.id === id),
    [data],
  )

  const value = useMemo<BrandsState>(
    () => ({ data, status, stale, error, reload, applyRow, removeRow, getById }),
    [data, status, stale, error, reload, applyRow, removeRow, getById],
  )

  return <BrandsContext.Provider value={value}>{children}</BrandsContext.Provider>
}

export function useBrands(): BrandsState {
  const ctx = useContext(BrandsContext)
  if (!ctx) throw new Error('useBrands используется вне BrandsProvider')
  return ctx
}
