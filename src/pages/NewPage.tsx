import { useNavigate } from 'react-router-dom'
import { ApiError, ERR_DUPLICATE, createBrand } from '../api/client'
import { BrandForm } from '../components/BrandForm'
import { useToast } from '../components/Toast'
import type { BrandRow } from '../api/types'
import { brandName, emptyValues } from '../lib/schema'
import { useBrands } from '../store/BrandsContext'
import { useWrite } from '../store/useWrite'

export function NewPage() {
  const navigate = useNavigate()
  const { data } = useBrands()
  const { run, busy } = useWrite()
  const toast = useToast()

  if (!data) return <p className="empty">Загружаем схему таблицы…</p>

  const save = async (values: BrandRow, force = false) => {
    try {
      const result = await run((creds) =>
        createBrand({ token: creds.token, author: creds.author, values, force }),
      )
      toast('Бренд добавлен в таблицу')
      navigate(`/brand/${encodeURIComponent(result.row.id)}`, { replace: true })
    } catch (err) {
      if (err instanceof Error && err.message === 'Отменено') return

      if (err instanceof ApiError && err.code === ERR_DUPLICATE) {
        const duplicates = (err.details.duplicates as BrandRow[] | undefined) ?? []
        const names = duplicates.map((d) => brandName(d, data.fields)).join(', ')
        if (confirm(`В базе уже есть: ${names}.\nВсё равно добавить новый бренд?`)) {
          await save(values, true)
        }
        return
      }

      toast(err instanceof Error ? err.message : 'Не удалось сохранить', 'error')
    }
  }

  return (
    <>
      <h1>Новый бренд</h1>
      <BrandForm
        fields={data.fields}
        rows={data.rows}
        initial={emptyValues(data.fields)}
        submitLabel="Добавить"
        busy={busy}
        onSubmit={(values) => void save(values)}
        onCancel={() => navigate(-1)}
      />
    </>
  )
}
