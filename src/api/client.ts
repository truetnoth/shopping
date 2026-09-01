import type { PostgrestError } from '@supabase/supabase-js'
import { CATEGORIES, tableOf } from '../lib/categories'
import { CONFIG_ERROR, configured, supabase } from '../lib/supabase'
import type { BrandRow, CategoryId, Dataset, FieldDef, FieldType, WriteResult } from './types'

export const ERR_UNAUTHORIZED = 401
export const ERR_NOT_FOUND = 404
export const ERR_CONFLICT = 409
export const ERR_DUPLICATE = 422

export class ApiError extends Error {
  code: number
  details: Record<string, unknown>

  constructor(code: number, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

/** Служебные колонки в форме не показываются и в схему не попадают. */
const SYSTEM_COLUMNS = ['id', 'updated_at', 'updated_by', 'archived', 'category']

// ---------------------------------------------------------------------------
// Чтение
// ---------------------------------------------------------------------------

interface FieldRow {
  table_name: string
  column_name: string
  label: string
  type: string
  options: string[] | null
  required: boolean
  searchable: boolean
  show_in_card: boolean
  sort_order: number
  is_name: boolean
}

/**
 * Одна загрузка на весь сайт: описания полей всех трёх таблиц плюс их строки.
 * Данных немного, поэтому дешевле забрать всё разом, чем ходить по категориям.
 */
export async function fetchDataset(): Promise<Dataset> {
  if (!configured) throw new ApiError(500, CONFIG_ERROR)

  const [fieldsResult, ...rowResults] = await Promise.all([
    supabase.from('brand_fields').select('*').order('sort_order'),
    ...CATEGORIES.map((c) => supabase.from(c.table).select('*').order('name')),
  ])

  if (fieldsResult.error) throw toApiError(fieldsResult.error, 'Не удалось загрузить схему базы')

  const fields = {} as Dataset['fields']
  const rows = {} as Dataset['rows']

  CATEGORIES.forEach((category, i) => {
    const result = rowResults[i]
    if (result.error) throw toApiError(result.error, `Не удалось загрузить категорию «${category.label}»`)

    fields[category.id] = ((fieldsResult.data ?? []) as FieldRow[])
      .filter((f) => f.table_name === category.table)
      .map(toFieldDef)

    rows[category.id] = ((result.data ?? []) as Record<string, unknown>[]).map((raw) =>
      toRow(raw, category.id),
    )
  })

  return { fields, rows }
}

// ---------------------------------------------------------------------------
// Запись
// ---------------------------------------------------------------------------

export async function createBrand(input: {
  category: CategoryId
  author: string
  fields: FieldDef[]
  values: BrandRow
}): Promise<WriteResult> {
  await requireSession()

  const { data, error } = await supabase
    .from(tableOf(input.category))
    .insert({
      ...toPayload(input.values, input.fields),
      updated_at: new Date().toISOString(),
      updated_by: input.author,
      archived: false,
    })
    .select()
    .single()

  if (error) throw toApiError(error, 'Не удалось добавить бренд')
  return { category: input.category, row: toRow(data as Record<string, unknown>, input.category) }
}

export async function updateBrand(input: {
  category: CategoryId
  author: string
  id: string
  /** Версия строки на момент открытия формы — по ней ловим параллельную правку. */
  baseUpdatedAt: string
  fields: FieldDef[]
  values: BrandRow
}): Promise<WriteResult> {
  return writeExisting(input.category, input.id, input.baseUpdatedAt, {
    ...toPayload(input.values, input.fields),
    updated_by: input.author,
  })
}

export async function archiveBrand(input: {
  category: CategoryId
  author: string
  id: string
  baseUpdatedAt: string
  archived: boolean
}): Promise<WriteResult> {
  return writeExisting(input.category, input.id, input.baseUpdatedAt, {
    archived: input.archived,
    updated_by: input.author,
  })
}

/**
 * Общая часть update и archive. Условие `.eq('updated_at', baseUpdatedAt)` —
 * это оптимистичная блокировка: если строку уже поправили, под условие не
 * попадёт ни одной записи и мы не затрём чужие изменения молча.
 */
async function writeExisting(
  category: CategoryId,
  id: string,
  baseUpdatedAt: string,
  patch: Record<string, unknown>,
): Promise<WriteResult> {
  await requireSession()
  const table = tableOf(category)

  const { data, error } = await supabase
    .from(table)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('updated_at', baseUpdatedAt)
    .select()

  if (error) throw toApiError(error, 'Не удалось сохранить изменения')
  if (data && data.length) {
    return { category, row: toRow(data[0] as Record<string, unknown>, category) }
  }

  // Ноль изменённых строк: либо бренд успели поправить, либо он исчез.
  const current = await supabase.from(table).select('*').eq('id', id).maybeSingle()
  if (current.error) throw toApiError(current.error, 'Не удалось сохранить изменения')
  if (!current.data) {
    throw new ApiError(ERR_NOT_FOUND, 'Бренд не найден — возможно, его удалили из базы')
  }

  throw new ApiError(ERR_CONFLICT, 'Бренд уже изменили', {
    row: toRow(current.data as Record<string, unknown>, category),
    category,
  })
}

// ---------------------------------------------------------------------------
// Вспомогательное
// ---------------------------------------------------------------------------

/**
 * RLS блокирует запись без входа, но update без прав возвращает не ошибку,
 * а ноль строк — что неотличимо от конфликта. Поэтому сессию проверяем заранее.
 */
async function requireSession(): Promise<void> {
  if (!configured) throw new ApiError(500, CONFIG_ERROR)

  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    throw new ApiError(ERR_UNAUTHORIZED, 'Нужно войти под паролем редакции')
  }
}

function toFieldDef(f: FieldRow): FieldDef {
  return {
    column: f.column_name,
    label: f.label,
    type: f.type as FieldType,
    options: f.options ?? [],
    required: f.required,
    searchable: f.searchable,
    showInCard: f.show_in_card,
    order: f.sort_order,
    isName: f.is_name,
  }
}

/** Приводим ответ Postgres к строковому контракту BrandRow и метим категорией. */
function toRow(raw: Record<string, unknown>, category: CategoryId): BrandRow {
  const row: BrandRow = { category }
  for (const [key, value] of Object.entries(raw)) {
    row[key] = value === null || value === undefined ? '' : String(value)
  }
  return row
}

/** В базу уходят только колонки из схемы: служебные ставит сам клиент. */
function toPayload(values: BrandRow, fields: FieldDef[]): Record<string, string> {
  const payload: Record<string, string> = {}
  for (const field of fields) {
    if (SYSTEM_COLUMNS.includes(field.column)) continue
    payload[field.column] = String(values[field.column] ?? '')
  }
  return payload
}

function toApiError(error: PostgrestError, fallback: string): ApiError {
  // 42501 — RLS не пустила, PGRST301 — протухший токен. Для пользователя это
  // одно и то же: нужно войти заново.
  if (error.code === '42501' || error.code === 'PGRST301') {
    return new ApiError(ERR_UNAUTHORIZED, 'Нужно войти под паролем редакции')
  }
  return new ApiError(500, error.message || fallback)
}
