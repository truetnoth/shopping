import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchList, fetchVersion } from '../api/client'
import type { BrandRow, ListPayload } from '../api/types'
import { readCache, writeCache } from '../lib/cache'

type Status = 'loading' | 'ready' | 'error'

interface BrandsState {
  data: ListPayload | null
  status: Status
  /** Данные показаны из кэша и ещё проверяются на свежесть. */
  stale: boolean
  error: string | null
  reload: () => Promise<void>
  applyRow: (row: BrandRow, revision: number) => void
  getById: (id: string) => BrandRow | undefined
}

const BrandsContext = createContext<BrandsState | null>(null)

export function BrandsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ListPayload | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [stale, setStale] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const load = useCallback(async (cached: ListPayload | null) => {
    try {
      // Дешёвая проверка ревизии: если в таблице ничего не менялось,
      // полный список не тянем вовсе.
      if (cached) {
        const { revision } = await fetchVersion()
        if (revision === cached.revision) {
          setStale(false)
          setStatus('ready')
          setError(null)
          return
        }
      }

      const fresh = await fetchList()
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
    if (started.current) return
    started.current = true

    const cached = readCache()
    if (cached) {
      setData(cached)
      setStatus('ready')
      setStale(true)
    }
    void load(cached)
  }, [load])

  const reload = useCallback(async () => {
    setStale(true)
    await load(null)
  }, [load])

  const applyRow = useCallback((row: BrandRow, revision: number) => {
    setData((prev) => {
      if (!prev) return prev
      const rows = [...prev.rows]
      const at = rows.findIndex((r) => r.id === row.id)
      if (at === -1) rows.unshift(row)
      else rows[at] = row

      const next = { ...prev, rows, revision }
      writeCache(next)
      return next
    })
  }, [])

  const getById = useCallback(
    (id: string) => data?.rows.find((row) => row.id === id),
    [data],
  )

  const value = useMemo<BrandsState>(
    () => ({ data, status, stale, error, reload, applyRow, getById }),
    [data, status, stale, error, reload, applyRow, getById],
  )

  return <BrandsContext.Provider value={value}>{children}</BrandsContext.Provider>
}

export function useBrands(): BrandsState {
  const ctx = useContext(BrandsContext)
  if (!ctx) throw new Error('useBrands используется вне BrandsProvider')
  return ctx
}
