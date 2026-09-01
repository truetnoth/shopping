import type { BrandRow, FieldDef } from '../api/types'

/** Мультизначные поля лежат в ячейке через запятую. */
export function splitMulti(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinMulti(values: string[]): string {
  return values.join(', ')
}

export function isTruthy(value: string | undefined): boolean {
  const s = String(value ?? '').trim().toLowerCase()
  return s === 'true' || s === 'да' || s === '1' || s === 'yes'
}

export function isArchived(row: BrandRow): boolean {
  return isTruthy(row.archived)
}

export function nameField(fields: FieldDef[]): FieldDef | undefined {
  return fields.find((f) => f.isName) ?? fields[0]
}

export function brandName(row: BrandRow, fields: FieldDef[]): string {
  const field = nameField(fields)
  return field ? row[field.column] || '(без названия)' : '(без названия)'
}

/**
 * Варианты для фильтров: то, что задано в _schema, плюс всё, что реально
 * встречается в таблице (редакция часто вписывает новое значение руками).
 */
export function collectOptions(field: FieldDef, rows: BrandRow[]): string[] {
  const seen = new Set<string>(field.options)
  for (const row of rows) {
    const raw = row[field.column]
    if (!raw) continue
    if (field.type === 'multiselect') splitMulti(raw).forEach((v) => seen.add(v))
    else seen.add(String(raw).trim())
  }
  return Array.from(seen).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru'))
}

export function filterableFields(fields: FieldDef[]): FieldDef[] {
  return fields.filter((f) => f.type === 'select' || f.type === 'multiselect' || f.type === 'bool')
}

/**
 * Чем булево поле записывается обратно в таблицу. В базе брендов галочки
 * проставлены словом «да» при пустой ячейке вместо «нет» — конвенция задаётся
 * в _schema через options: «да» → пишем «да» и пустую строку.
 */
export function boolPair(field: FieldDef): [string, string] {
  if (field.options.length) return [field.options[0], field.options[1] ?? '']
  return ['TRUE', 'FALSE']
}

export type Filters = Record<string, string[]>

export function applyFilters(rows: BrandRow[], filters: Filters, fields: FieldDef[]): BrandRow[] {
  const active = Object.entries(filters).filter(([, values]) => values.length > 0)
  if (!active.length) return rows

  const byColumn = new Map(fields.map((f) => [f.column, f]))

  return rows.filter((row) =>
    active.every(([column, wanted]) => {
      const field = byColumn.get(column)
      const cell = row[column]
      // У булева поля чип один: он включён — значит нужны только строки с «да».
      if (field?.type === 'bool') return isTruthy(cell)
      if (field?.type === 'multiselect') {
        const owned = splitMulti(cell)
        return wanted.some((w) => owned.includes(w))
      }
      return wanted.includes(String(cell ?? '').trim())
    }),
  )
}

export interface ValidationResult {
  errors: Record<string, string>
  ok: boolean
}

export function validate(fields: FieldDef[], values: BrandRow): ValidationResult {
  const errors: Record<string, string> = {}

  for (const field of fields) {
    const raw = String(values[field.column] ?? '').trim()

    if (field.required && !raw) {
      errors[field.column] = 'Обязательное поле'
      continue
    }
    if (!raw) continue

    if (field.type === 'url' && !/^https?:\/\/\S+$/i.test(raw)) {
      errors[field.column] = 'Ссылка должна начинаться с http:// или https://'
    }
    if (field.type === 'number' && Number.isNaN(Number(raw.replace(',', '.')))) {
      errors[field.column] = 'Ожидается число'
    }
  }

  return { errors, ok: Object.keys(errors).length === 0 }
}

/** Пустая заготовка для формы создания. */
export function emptyValues(fields: FieldDef[]): BrandRow {
  const values: BrandRow = {}
  for (const field of fields) values[field.column] = ''
  return values
}

/**
 * Названия сравниваем огрублённо: регистр, «ё» и лишние пробелы не должны
 * прятать дубль. Порт normalizeName_ из прежнего бэкенда на Apps Script.
 */
export function normalizeName(value: string | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Раньше дубли искал сервер, теперь — клиент: вся база уже загружена, поход
 * на бэкенд ради этого не нужен. Ограничиваем пятью, как и прежде.
 */
export function findDuplicates(
  rows: BrandRow[],
  fields: FieldDef[],
  name: string,
  exceptId?: string,
): BrandRow[] {
  const column = nameField(fields)?.column
  if (!column) return []

  const needle = normalizeName(name)
  if (!needle) return []

  return rows
    .filter((row) => row.id !== exceptId && normalizeName(row[column]) === needle)
    .slice(0, 5)
}

/**
 * Общее ядро для поиска по всем категориям сразу: поля, которые есть во всех
 * трёх схемах. Считается автоматически — добавили колонку во все три таблицы,
 * и она сама стала общей, никакой отдельной настройки.
 */
export function coreFields(schemas: FieldDef[][]): FieldDef[] {
  const [first, ...rest] = schemas.filter((s) => s.length)
  if (!first) return []

  const elsewhere = rest.map((s) => new Set(s.map((f) => f.column)))
  return first
    .filter((field) => elsewhere.every((columns) => columns.has(field.column)))
    .sort((a, b) => a.order - b.order)
}
