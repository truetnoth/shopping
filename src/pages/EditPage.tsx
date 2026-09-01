import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, ERR_CONFLICT, updateBrand } from '../api/client'
import { BrandForm } from '../components/BrandForm'
import { useToast } from '../components/Toast'
import type { BrandRow } from '../api/types'
import { isCategoryId } from '../lib/categories'
import { useBrands } from '../store/BrandsContext'
import { useWrite } from '../store/useWrite'

export function EditPage() {
  const { category, id = '' } = useParams()
  const navigate = useNavigate()
  const { data, getById, applyRow } = useBrands()
  const { run, busy } = useWrite()
  const toast = useToast()

  if (!data) return <p className="empty">Загружаем…</p>
  if (!isCategoryId(category)) return <NotFound />

  const row = getById(category, decodeURIComponent(id))
  if (!row) return <NotFound />

  const fields = data.fields[category]

  const save = async (values: BrandRow) => {
    try {
      await run((creds) =>
        updateBrand({
          category,
          author: creds.author,
          id: row.id,
          // Версия строки на момент открытия формы: по ней ловим параллельную
          // правку и не даём молча затереть чужие изменения.
          baseUpdatedAt: row.updated_at ?? '',
          fields,
          values,
        }),
      )
      toast('Изменения сохранены')
      navigate(`/brand/${category}/${encodeURIComponent(row.id)}`, { replace: true })
    } catch (err) {
      if (err instanceof Error && err.message === 'Отменено') return

      if (err instanceof ApiError && err.code === ERR_CONFLICT) {
        const current = err.details.row as BrandRow | undefined
        if (current) applyRow(category, current)
        toast(
          'Бренд уже изменили. Форма обновлена — проверьте актуальные данные и сохраните заново.',
          'error',
        )
        return
      }

      toast(err instanceof Error ? err.message : 'Не удалось сохранить', 'error')
    }
  }

  return (
    <>
      <h1>Редактирование</h1>
      <BrandForm
        // key сбрасывает состояние формы, когда строка обновилась после конфликта.
        key={row.updated_at}
        fields={fields}
        rows={data.rows[category]}
        initial={row}
        submitLabel="Сохранить"
        busy={busy}
        onSubmit={(values) => void save(values)}
        onCancel={() => navigate(-1)}
      />
    </>
  )
}

function NotFound() {
  return (
    <div className="empty">
      <p>Бренд не найден.</p>
      <Link className="btn btn--ghost" to="/">К поиску</Link>
    </div>
  )
}
