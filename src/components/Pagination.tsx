import { pageItems } from '../lib/paginate'

interface Props {
  page: number
  pageCount: number
  onChange: (page: number) => void
}

/** Переключатель страниц списка. На одной странице не показывается вовсе. */
export function Pagination({ page, pageCount, onChange }: Props) {
  if (pageCount <= 1) return null

  return (
    <nav className="pager" aria-label="Страницы списка">
      <button
        type="button"
        className="chip"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Предыдущая страница"
      >
        ←
      </button>

      {pageItems(page, pageCount).map((item, i) =>
        typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            className={`chip${item === page ? ' chip--on' : ''}`}
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
          >
            {item}
          </button>
        ) : (
          <span key={`gap-${i}`} className="pager__gap" aria-hidden="true">
            {item}
          </span>
        ),
      )}

      <button
        type="button"
        className="chip"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Следующая страница"
      >
        →
      </button>
    </nav>
  )
}
