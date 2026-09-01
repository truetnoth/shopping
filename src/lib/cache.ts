import type { Dataset } from '../api/types'

// v2: в кэше лежат все три категории сразу, версия v1 (одна таблица) не читается.
const KEY = 'brands.cache.v2'

export interface CachedDataset extends Dataset {
  fetchedAt: number
}

export function readCache(): CachedDataset | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedDataset
    if (!parsed.fields || !parsed.rows) return null
    return parsed
  } catch {
    return null
  }
}

export function writeCache(dataset: Dataset): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...dataset, fetchedAt: Date.now() }))
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
