import type { BrandRow, CategoryId, FieldDef } from '../api/types'
import { categoryLabel } from '../lib/categories'
import { brandName } from '../lib/schema'

/**
 * Предупреждение о похожем названии под полем бренда. Ссылки открываются в
 * новой вкладке: заглянуть в подозреваемого, не потеряв заполненную форму.
 */
export function SimilarNote({ rows, fields }: { rows: BrandRow[]; fields: FieldDef[] }) {
  if (!rows.length) return null

  return (
    <p className="field__warn">
      Похожий бренд уже есть:{' '}
      {rows.map((row, i) => (
        <span key={row.id}>
          {i > 0 && ', '}
          <a
            href={`#/brand/${row.category}/${encodeURIComponent(row.id)}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            {brandName(row, fields)}
          </a>
          {' — '}
          {categoryLabel(row.category as CategoryId)}
        </span>
      ))}
    </p>
  )
}
