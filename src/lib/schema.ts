import type { BrandRow, FieldDef } from '../api/types'
import { phoneticKey } from './translit'

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

/** Справочник, в который значения можно дописывать прямо из формы. */
export function isOpen(field: FieldDef): boolean {
  return field.type === 'openselect' || field.type === 'openmulti'
}

/** Справочник, в котором значений можно выбрать несколько (лежат через запятую). */
export function isMulti(field: FieldDef): boolean {
  return field.type === 'multiselect' || field.type === 'openmulti'
}

/**
 * Кнопки справочника в форме: варианты берёт только field_defs, порядок — как в
 * базе (там он осмысленный: $ · $$ · $$$). Плюс значения, которые уже стоят в
 * строке, но из справочника исчезли: снять их можно, а вот молча стереть при
 * сохранении — нет.
 *
 * Исключение — открытые справочники (openselect и openmulti): к вариантам из
 * базы они добавляют всё, что уже встречается в переданных строках. Так
 * вписанный из формы город становится кнопкой у всей редакции, не требуя
 * правки field_defs.
 */
export function optionsWithOwn(field: FieldDef, value: string, rows: BrandRow[] = []): string[] {
  const base = isOpen(field)
    ? [...field.options, ...valuesInUse(field, rows).filter((v) => !field.options.includes(v))]
    : field.options

  const own = isMulti(field) ? splitMulti(value) : [String(value ?? '').trim()]
  const extra = own.filter((v) => v && !base.includes(v))
  return extra.length ? [...base, ...extra] : base
}

/** Значения колонки, реально встречающиеся в базе, — по алфавиту и без дублей. */
export function valuesInUse(field: FieldDef, rows: BrandRow[]): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    const cell = row[field.column]
    const values = isMulti(field) ? splitMulti(cell) : [String(cell ?? '').trim()]
    for (const value of values) if (value) seen.add(value)
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, 'ru'))
}

/**
 * Значение, вписанное в открытый справочник руками. Если такое уже есть с другим
 * регистром — возвращаем известное написание: именно из-за «казань» рядом с
 * «Казань» открытые списки когда-то и закрыли.
 */
export function normalizeOption(input: string, options: string[]): string {
  const value = String(input ?? '').trim()
  if (!value) return ''
  const known = options.find((o) => o.toLowerCase() === value.toLowerCase())
  return known ?? value
}

export function filterableFields(fields: FieldDef[]): FieldDef[] {
  return fields.filter(
    (f) =>
      f.type === 'select' ||
      f.type === 'multiselect' ||
      f.type === 'openselect' ||
      f.type === 'openmulti' ||
      f.type === 'bool',
  )
}

/** Ссылка на сайт бренда — первое поле типа url; по имени колонку не ищем. */
export function urlField(fields: FieldDef[]): FieldDef | undefined {
  return fields.find((f) => f.type === 'url')
}

/**
 * Граница между фильтрами, которые видно сразу, и теми, что лежат под
 * раскрывашкой. Порядок полей задаёт редакция в field_defs — значит, оттуда же
 * правится и состав главных фильтров, без единой правки кода. Сейчас в начале
 * стоят название (1), сайт (2), категория (3), «Для кого» / «Предназначение»
 * (4), сегмент (5) и «Мультибренд» (6); фильтруются из них последние четыре.
 */
export const PRIMARY_FILTER_MAX_ORDER = 6

export function splitFilters(fields: FieldDef[]): { primary: FieldDef[]; extra: FieldDef[] } {
  const filterable = filterableFields(fields)
  return {
    primary: filterable.filter((f) => f.order <= PRIMARY_FILTER_MAX_ORDER),
    extra: filterable.filter((f) => f.order > PRIMARY_FILTER_MAX_ORDER),
  }
}

export type FilterGroup =
  | { kind: 'field'; order: number; field: FieldDef }
  /** Пустой label — заголовка у группы нет, галочка стоит отдельной строкой. */
  | { kind: 'bools'; order: number; label: string; fields: FieldDef[] }

/**
 * Фильтры, разложенные по группам в порядке полей. Обычное поле даёт свою
 * группу; галочка — тоже свою, без заголовка, если редакция не собрала её с
 * другими через field_defs.filter_group.
 *
 * Умолчание тут «каждая сама по себе» намеренно: «Мультибренд», «Продается на
 * маркетплейсе» и «ЖП» редакция просила видеть отдельными пунктами, а не в
 * общей куче, — она путала их с остальными свойствами бренда. В кучу собраны
 * только те, у кого filter_group совпал: производство, ручная работа, винтаж и
 * СТМ под заголовком «Особенности».
 *
 * Общая группа встаёт туда, где стоит первая её галочка, а не в конец списка.
 * Иначе порядок полей для галочек не решал бы ничего: «Особенности» всегда
 * уезжали бы под «Город» и «Страну».
 */
export function filterGroups(fields: FieldDef[]): FilterGroup[] {
  const groups: FilterGroup[] = []
  // Общие группы копим по имени, чтобы каждая встала по своей первой галочке.
  const shared = new Map<string, Extract<FilterGroup, { kind: 'bools' }>>()

  for (const field of fields) {
    if (field.type !== 'bool') {
      groups.push({ kind: 'field', order: field.order, field })
      continue
    }

    if (!field.filterGroup) {
      groups.push({ kind: 'bools', order: field.order, label: '', fields: [field] })
      continue
    }

    const group = shared.get(field.filterGroup)
    if (group) {
      group.fields.push(field)
      group.order = Math.min(group.order, field.order)
    } else {
      const fresh = {
        kind: 'bools' as const,
        order: field.order,
        label: field.filterGroup,
        fields: [field],
      }
      shared.set(field.filterGroup, fresh)
      groups.push(fresh)
    }
  }

  return groups.sort((a, b) => a.order - b.order)
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
      if (field && isMulti(field)) {
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
 * Похожие названия. Сравниваем не буквы, а огрублённый фонетический ключ —
 * тот же, которым поиск ловит «Гуччи» по записи «Gucci». Регистр, «ё», лишние
 * пробелы, дефисы и двойные буквы он приводит к одному виду сам.
 *
 * Ищет клиент: вся база и так загружена, поход на бэкенд ради этого не нужен.
 * Ограничиваем пятью — это подсказка, а не выдача.
 */
export function findSimilar(
  rows: BrandRow[],
  fields: FieldDef[],
  name: string,
  exceptId?: string,
): BrandRow[] {
  const column = nameField(fields)?.column
  if (!column) return []

  const needle = phoneticKey(name)
  if (!needle) return []

  return rows
    .filter((row) => row.id !== exceptId && phoneticKey(row[column] ?? '') === needle)
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
