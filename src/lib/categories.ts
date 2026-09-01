import type { CategoryId } from '../api/types'

export interface Category {
  id: CategoryId
  label: string
  table: string
}

export const CATEGORIES: Category[] = [
  { id: 'fashion', label: 'Мода', table: 'brands_fashion' },
  { id: 'lifestyle', label: 'Лайфстайл', table: 'brands_lifestyle' },
  { id: 'beauty', label: 'Красота', table: 'brands_beauty' },
]

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]))

export function isCategoryId(value: string | undefined): value is CategoryId {
  return Boolean(value) && BY_ID.has(value as CategoryId)
}

export function categoryLabel(id: CategoryId): string {
  return BY_ID.get(id)?.label ?? id
}

export function tableOf(id: CategoryId): string {
  const table = BY_ID.get(id)?.table
  if (!table) throw new Error(`Неизвестная категория: ${id}`)
  return table
}
