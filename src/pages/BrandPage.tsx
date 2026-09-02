import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, ERR_CONFLICT, archiveBrand, deleteBrand } from '../api/client'
import { useToast } from '../components/Toast'
import { categoryLabel, isCategoryId } from '../lib/categories'
import { brandName, isArchived, splitMulti } from '../lib/schema'
import { useBrands } from '../store/BrandsContext'
import { useWrite } from '../store/useWrite'
import type { BrandRow, FieldDef } from '../api/types'

export function BrandPage() {
  const { category, id = '' } = useParams()
  const navigate = useNavigate()
  const { data, getById, applyRow, removeRow } = useBrands()
  const { run, busy } = useWrite()
  const toast = useToast()

  if (!data) return null
  if (!isCategoryId(category)) return <NotFound />

  const row = getById(category, decodeURIComponent(id))
  if (!row) return <NotFound />

  const fields = data.fields[category]
  const archived = isArchived(row)

  const toggleArchive = async () => {
    const question = archived
      ? 'Вернуть бренд из архива?'
      : 'Убрать бренд в архив? Он останется в базе, но пропадёт из выдачи.'
    if (!confirm(question)) return

    try {
      await run((creds) =>
        archiveBrand({
          category,
          author: creds.author,
          id: row.id,
          baseUpdatedAt: row.updated_at ?? '',
          archived: !archived,
        }),
      )
      toast(archived ? 'Бренд возвращён в базу' : 'Бренд убран в архив')
    } catch (err) {
      if (err instanceof Error && err.message === 'Отменено') return

      if (err instanceof ApiError && err.code === ERR_CONFLICT) {
        const current = err.details.row as BrandRow | undefined
        if (current) applyRow(category, current)
        toast('Бренд уже изменили — карточка обновлена, попробуйте ещё раз.', 'error')
        return
      }

      toast(err instanceof Error ? err.message : 'Не удалось сохранить', 'error')
    }
  }

  const remove = async () => {
    const question =
      `Удалить бренд «${brandName(row, fields)}» навсегда?\n\n` +
      'Отменить это будет нельзя. Чтобы просто убрать бренд из выдачи, ' +
      'используйте «В архив».'
    if (!confirm(question)) return

    try {
      await run(() => deleteBrand({ category, id: row.id }))
      removeRow(category, row.id)
      toast('Бренд удалён из базы')
      // Возвращаться на страницу удалённого бренда некуда.
      navigate(`/c/${category}`, { replace: true })
    } catch (err) {
      if (err instanceof Error && err.message === 'Отменено') return
      toast(err instanceof Error ? err.message : 'Не удалось удалить', 'error')
    }
  }

  return (
    <article className="brand">
      <header className="brand__header">
        <div className="brand__title">
          <button className="btn btn--ghost btn--small" onClick={() => navigate(-1)}>
            ← Назад
          </button>
          <h1>
            {brandName(row, fields)}
            <span className="badge badge--muted">{categoryLabel(category)}</span>
            {archived && <span className="badge">в архиве</span>}
          </h1>
        </div>
        <div className="brand__actions">
          <Link
            className="btn btn--primary"
            to={`/brand/${category}/${encodeURIComponent(row.id)}/edit`}
          >
            Редактировать
          </Link>
          <button className="btn btn--ghost" onClick={() => void toggleArchive()} disabled={busy}>
            {archived ? 'Вернуть из архива' : 'В архив'}
          </button>
          <button className="btn btn--danger" onClick={() => void remove()} disabled={busy}>
            Удалить
          </button>
        </div>
      </header>

      <dl className="brand__fields">
        {fields
          .filter((field) => !field.isName && row[field.column])
          .map((field) => (
            <div key={field.column} className="brand__field">
              <dt>{field.label}</dt>
              <dd>
                <Value field={field} value={row[field.column]} />
              </dd>
            </div>
          ))}
      </dl>

      <footer className="brand__footer muted">
        {row.updated_at && <span>Изменено: {formatDate(row.updated_at)}</span>}
        {row.updated_by && <span> · {row.updated_by}</span>}
      </footer>
    </article>
  )
}

function NotFound() {
  return (
    <div className="empty">
      <p>Бренд не найден — возможно, его удалили из базы.</p>
      <Link className="btn btn--ghost" to="/">К поиску</Link>
    </div>
  )
}

function Value({ field, value }: { field: FieldDef; value: string }) {
  if (field.type === 'url') {
    return (
      <a href={value} target="_blank" rel="noreferrer noopener">
        {value.replace(/^https?:\/\//, '')}
      </a>
    )
  }
  if (field.type === 'multiselect') {
    return (
      <span className="chips">
        {splitMulti(value).map((v) => (
          <span key={v} className="chip chip--static">{v}</span>
        ))}
      </span>
    )
  }
  return <span className="prewrap">{value}</span>
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('ru-RU')
}
