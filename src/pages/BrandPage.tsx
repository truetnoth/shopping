import { Link, useNavigate, useParams } from 'react-router-dom'
import { archiveBrand } from '../api/client'
import { useToast } from '../components/Toast'
import { brandName, isArchived, splitMulti } from '../lib/schema'
import { useBrands } from '../store/BrandsContext'
import { useWrite } from '../store/useWrite'
import type { FieldDef } from '../api/types'

export function BrandPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, getById } = useBrands()
  const { run, busy } = useWrite()
  const toast = useToast()

  const row = getById(decodeURIComponent(id))

  if (!data) return null
  if (!row) {
    return (
      <div className="empty">
        <p>Бренд не найден — возможно, строку удалили из таблицы.</p>
        <Link className="btn btn--ghost" to="/">К поиску</Link>
      </div>
    )
  }

  const archived = isArchived(row)

  const toggleArchive = async () => {
    const question = archived
      ? 'Вернуть бренд из архива?'
      : 'Убрать бренд в архив? Строка останется в таблице, но пропадёт из выдачи.'
    if (!confirm(question)) return

    try {
      await run((creds) =>
        archiveBrand({ token: creds.token, author: creds.author, id: row.id, archived: !archived }),
      )
      toast(archived ? 'Бренд возвращён в базу' : 'Бренд убран в архив')
    } catch (err) {
      if (err instanceof Error && err.message === 'Отменено') return
      toast(err instanceof Error ? err.message : 'Не удалось сохранить', 'error')
    }
  }

  return (
    <article className="brand">
      <header className="brand__header">
        <h1>
          {brandName(row, data.fields)}
          {archived && <span className="badge">в архиве</span>}
        </h1>
        <div className="brand__actions">
          <Link className="btn btn--primary" to={`/brand/${encodeURIComponent(row.id)}/edit`}>
            Редактировать
          </Link>
          <button className="btn btn--ghost" onClick={() => void toggleArchive()} disabled={busy}>
            {archived ? 'Вернуть из архива' : 'В архив'}
          </button>
        </div>
      </header>

      <dl className="brand__fields">
        {data.fields
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

      <button className="btn btn--ghost" onClick={() => navigate(-1)}>
        Назад
      </button>
    </article>
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
