import { Link, useNavigate, useParams } from 'react-router-dom'
import { createBrand } from '../api/client'
import { BrandForm } from '../components/BrandForm'
import { useToast } from '../components/Toast'
import type { BrandRow } from '../api/types'
import { CATEGORIES, categoryLabel, isCategoryId } from '../lib/categories'
import { brandName, emptyValues, findDuplicates, nameField } from '../lib/schema'
import { useBrands } from '../store/BrandsContext'
import { useWrite } from '../store/useWrite'

export function NewPage() {
  const { category } = useParams()
  const navigate = useNavigate()
  const { data } = useBrands()
  const { run, busy } = useWrite()
  const toast = useToast()

  if (!data) return <p className="empty">Загружаем схему базы…</p>

  // Без категории в адресе сначала спрашиваем, куда добавлять бренд.
  if (!isCategoryId(category)) {
    return (
      <>
        <h1>Новый бренд</h1>
        <p className="muted">В какую категорию добавить?</p>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <Link key={c.id} className="btn btn--primary" to={`/new/${c.id}`}>
              {c.label}
            </Link>
          ))}
        </div>
      </>
    )
  }

  const fields = data.fields[category]
  const rows = data.rows[category]

  const save = async (values: BrandRow, force = false) => {
    // Дубли ищем на клиенте: вся база уже загружена, ходить на сервер незачем.
    if (!force) {
      const name = values[nameField(fields)?.column ?? ''] ?? ''
      const duplicates = findDuplicates(rows, fields, name)
      if (duplicates.length) {
        const names = duplicates.map((d) => brandName(d, fields)).join(', ')
        if (!confirm(`В категории «${categoryLabel(category)}» уже есть: ${names}.\nВсё равно добавить новый бренд?`)) {
          return
        }
      }
    }

    try {
      const result = await run((creds) =>
        createBrand({ category, author: creds.author, fields, values }),
      )
      toast('Бренд добавлен в базу')
      navigate(`/brand/${category}/${encodeURIComponent(result.row.id)}`, { replace: true })
    } catch (err) {
      if (err instanceof Error && err.message === 'Отменено') return
      toast(err instanceof Error ? err.message : 'Не удалось сохранить', 'error')
    }
  }

  return (
    <>
      <h1>Новый бренд · {categoryLabel(category)}</h1>
      <BrandForm
        fields={fields}
        rows={rows}
        initial={emptyValues(fields)}
        submitLabel="Добавить"
        busy={busy}
        onSubmit={(values) => void save(values)}
        onCancel={() => navigate(-1)}
      />
    </>
  )
}
