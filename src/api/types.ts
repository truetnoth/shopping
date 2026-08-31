export type FieldType =
  | 'text'
  | 'longtext'
  | 'url'
  | 'select'
  | 'multiselect'
  | 'number'
  | 'date'
  | 'bool'

/** Описание одной колонки таблицы. Приходит с бэкенда, в коде не хардкодится. */
export interface FieldDef {
  column: string
  label: string
  type: FieldType
  options: string[]
  required: boolean
  searchable: boolean
  showInCard: boolean
  order: number
  isName: boolean
}

/** Строка таблицы: все значения — строки, ровно как в Google Sheets. */
export type BrandRow = Record<string, string>

export interface ListPayload {
  revision: number
  nameColumn: string
  fields: FieldDef[]
  rows: BrandRow[]
}

export interface WritePayload {
  row: BrandRow
  revision: number
}

export interface DuplicateInfo {
  duplicates: BrandRow[]
}

export interface ConflictInfo {
  row: BrandRow
  revision: number
}
