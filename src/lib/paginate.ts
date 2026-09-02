/** Сколько брендов показываем на одной странице списка. */
export const PAGE_SIZE = 20

const ELLIPSIS = '…'
export type PageItem = number | typeof ELLIPSIS

/**
 * Номера страниц для переключателя: первая, последняя, текущая с соседями,
 * между ними — многоточия. Пока страниц мало, показываем все подряд.
 */
export function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: Math.max(pageCount, 0) }, (_, i) => i + 1)
  }

  const around = [page - 1, page, page + 1].filter((p) => p > 1 && p < pageCount)
  const items: PageItem[] = [1]

  if (around[0] > 2) items.push(ELLIPSIS)
  items.push(...around)
  if (around[around.length - 1] < pageCount - 1) items.push(ELLIPSIS)
  items.push(pageCount)

  return items
}
