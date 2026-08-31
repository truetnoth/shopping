import type { ListPayload } from '../api/types'

const KEY = 'brands.cache.v1'

export interface CachedList extends ListPayload {
  fetchedAt: number
}

export function readCache(): CachedList | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedList
    if (!Array.isArray(parsed.rows) || !Array.isArray(parsed.fields)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeCache(payload: ListPayload): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...payload, fetchedAt: Date.now() }))
  } catch {
    // Переполнение квоты или приватный режим: кэш не критичен, просто теряем
    // мгновенную отрисовку при следующем заходе.
  }
}

export function clearCache(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* см. выше */
  }
}
