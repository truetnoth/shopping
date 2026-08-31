import { Link } from 'react-router-dom'
import type { BrandRow, FieldDef } from '../api/types'
import { brandName, isArchived, nameField } from '../lib/schema'

interface Props {
  rows: BrandRow[]
  fields: FieldDef[]
}

export function BrandList({ rows, fields }: Props) {
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
          <Link className="brand-card" to={`/brand/${encodeURIComponent(row.id)}`}>
            <span className="brand-card__name">
              {brandName(row, fields)}
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
