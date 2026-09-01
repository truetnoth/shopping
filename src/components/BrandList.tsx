import { Link } from 'react-router-dom'
import type { BrandRow, CategoryId, FieldDef } from '../api/types'
import { categoryLabel } from '../lib/categories'
import { brandName, isArchived, nameField } from '../lib/schema'

interface Props {
  rows: BrandRow[]
  fields: FieldDef[]
  /** В режиме «Все» показываем, из какой категории бренд. */
  showCategory?: boolean
}

export function BrandList({ rows, fields, showCategory = false }: Props) {
  const name = nameField(fields)
  // В карточке списка показываем название плюс пару самых информативных полей.
  const preview = fields.filter((f) => f.showInCard && f.column !== name?.column).slice(0, 3)

  if (!rows.length) {
    return <p className="empty">Ничего не нашлось. Попробуйте другой запрос или снимите фильтры.</p>
  }

  return (
    <ul className="brands">
      {rows.map((row, i) => (
        <li key={row.id || i}>
          <Link
            className="brand-card"
            to={`/brand/${row.category}/${encodeURIComponent(row.id)}`}
          >
            <span className="brand-card__name">
              {brandName(row, fields)}
              {showCategory && (
                <span className="badge badge--muted">
                  {categoryLabel(row.category as CategoryId)}
                </span>
              )}
              {isArchived(row) && <span className="badge">в архиве</span>}
            </span>
            <span className="brand-card__meta">
              {preview
                .map((field) => row[field.column])
                .filter(Boolean)
                .join(' · ')}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
