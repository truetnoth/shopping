import MiniSearch from 'minisearch'
import type { BrandRow, FieldDef } from '../api/types'
import { phoneticKey } from './translit'

const PHONETIC_FIELD = '__phonetic'

type Doc = Record<string, string> & { __key: string }

export interface SearchIndex {
  engine: MiniSearch<Doc>
  byKey: Map<string, BrandRow>
}

/**
 * Индекс строится один раз на загруженный список и переживает фильтрацию:
 * фильтры применяются к результату поиска, а не к индексу.
 */
export function buildIndex(fields: FieldDef[], rows: BrandRow[]): SearchIndex {
  const searchable = fields.filter((f) => f.searchable).map((f) => f.column)
  const name = fields.find((f) => f.isName)?.column

  const byKey = new Map<string, BrandRow>()
  const docs: Doc[] = rows.map((row, i) => {
    const key = row.id || `row-${i}`
    byKey.set(key, row)

    const doc: Doc = { __key: key }
    for (const column of searchable) doc[column] = String(row[column] ?? '')
    // Отдельным полем — фонетический ключ названия: он ловит запрос в другой
    // раскладке («Гуччи» → Gucci).
    doc[PHONETIC_FIELD] = name ? phoneticKey(String(row[name] ?? '')) : ''
    return doc
  })

  const engine = new MiniSearch<Doc>({
    idField: '__key',
    fields: [...searchable, PHONETIC_FIELD],
    storeFields: ['__key'],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
      boost: name ? { [name]: 4 } : {},
    },
  })

  engine.addAll(docs)
  return { engine, byKey }
}

export function runSearch(index: SearchIndex, query: string): BrandRow[] {
  const q = query.trim()
  if (!q) return Array.from(index.byKey.values())

  const direct = index.engine.search(q)

  // Второй проход — только по фонетическому полю, чтобы огрублённый ключ
  // не тащил лишнее в обычную выдачу.
  const key = phoneticKey(q)
  const phonetic = key
    ? index.engine.search(key, { fields: [PHONETIC_FIELD], combineWith: 'AND' })
    : []

  const seen = new Set<string>()
  const out: BrandRow[] = []
  for (const hit of [...direct, ...phonetic]) {
    const id = String(hit.id)
    if (seen.has(id)) continue
    seen.add(id)
    const row = index.byKey.get(id)
    if (row) out.push(row)
  }
  return out
}
