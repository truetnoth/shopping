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

/** Три крупные категории — три таблицы со своими наборами полей. */
export type CategoryId = 'fashion' | 'lifestyle' | 'beauty'

/** Верхнеуровневый фильтр: конкретная категория либо поиск по всем сразу. */
export type Scope = CategoryId | 'all'

/**
 * Строка таблицы: все значения — строки, потому что состав колонок заранее не
 * известен — он приходит из базы. Отсюда соглашения: мультизначные поля лежат
 * через запятую, галочки — словом («да»).
 * Служебные ключи: id, updated_at, updated_by, archived, category.
 */
export type BrandRow = Record<string, string>

/** Всё, что сайт держит в памяти: схемы и строки по каждой из трёх категорий. */
export interface Dataset {
  fields: Record<CategoryId, FieldDef[]>
  rows: Record<CategoryId, BrandRow[]>
}

export interface WriteResult {
  category: CategoryId
  row: BrandRow
}
