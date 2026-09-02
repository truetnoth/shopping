import { Link } from 'react-router-dom'
import type { BrandRow, CategoryId, FieldDef } from '../api/types'
import { categoryLabel } from '../lib/categories'
import { brandName, isArchived, nameField, urlField } from '../lib/schema'

interface Props {
  rows: BrandRow[]
  fields: FieldDef[]
  /** В режиме «Все» показываем, из какой категории бренд. */
  showCategory?: boolean
}

export function BrandList({ rows, fields, showCategory = false }: Props) {
  const name = nameField(fields)
  const site = urlField(fields)
  // В карточке списка показываем название плюс пару самых информативных полей.
  const preview = fields.filter((f) => f.showInCard && f.column !== name?.column).slice(0, 3)

  if (!rows.length) {
    return <p className="empty">Ничего не нашлось. Попробуйте другой запрос или снимите фильтры.</p>
  }

  return (
    <ul className="brands">
      {rows.map((row, i) => {
        const href = site ? row[site.column] : ''

        return (
          // Кнопки нельзя положить внутрь ссылки, поэтому ссылка на карточку
          // бренда растягивается на всю плашку через ::after, а действия лежат
          // поверх неё — клик мимо кнопок работает как раньше.
          <li key={row.id || i} className="brand-card">
            <Link
              className="brand-card__link"
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

            <div className="brand-card__actions">
              {href && (
                <a
                  className="btn btn--small"
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  На сайт бренда
                </a>
              )}
              <Link
                className="btn btn--small"
                to={`/brand/${row.category}/${encodeURIComponent(row.id)}/edit`}
              >
                Редактировать
              </Link>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
