import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, ERR_CONFLICT, updateBrand } from '../api/client'
import { BrandForm } from '../components/BrandForm'
import { useToast } from '../components/Toast'
import type { BrandRow } from '../api/types'
import { useBrands } from '../store/BrandsContext'
import { useWrite } from '../store/useWrite'

export function EditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, getById, applyRow } = useBrands()
  const { run, busy } = useWrite()
  const toast = useToast()

  const row = getById(decodeURIComponent(id))

  if (!data) return <p className="empty">Загружаем…</p>
  if (!row) {
    return (
      <div className="empty">
        <p>Бренд не найден.</p>
        <Link className="btn btn--ghost" to="/">К поиску</Link>
      </div>
    )
  }

  const save = async (values: BrandRow) => {
    try {
      await run((creds) =>
        updateBrand({
          token: creds.token,
          author: creds.author,
          id: row.id,
          // Версия строки на момент открытия формы: бэкенд по ней ловит
          // параллельную правку и не даёт молча затереть чужие изменения.
          baseUpdatedAt: row.updated_at ?? '',
          values,
        }),
      )
      toast('Изменения сохранены в таблице')
      navigate(`/brand/${encodeURIComponent(row.id)}`, { replace: true })
    } catch (err) {
      if (err instanceof Error && err.message === 'Отменено') return

      if (err instanceof ApiError && err.code === ERR_CONFLICT) {
        const current = err.details.row as BrandRow | undefined
        const revision = err.details.revision as number | undefined
        if (current && revision !== undefined) applyRow(current, revision)
        toast(
          'Бренд уже изменили в таблице. Форма обновлена — проверьте актуальные данные и сохраните заново.',
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
        fields={data.fields}
        rows={data.rows}
        initial={row}
        submitLabel="Сохранить"
        busy={busy}
        onSubmit={(values) => void save(values)}
        onCancel={() => navigate(-1)}
      />
    </>
  )
}
