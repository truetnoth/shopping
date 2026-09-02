import { useMemo, useState } from 'react'
import type { BrandRow, FieldDef } from '../api/types'
import { boolPair, collectOptions, isTruthy, joinMulti, splitMulti, validate } from '../lib/schema'

interface Props {
  fields: FieldDef[]
  rows: BrandRow[]
  initial: BrandRow
  submitLabel: string
  busy?: boolean
  onSubmit: (values: BrandRow) => void
  onCancel: () => void
}

/**
 * Одна форма и для создания, и для редактирования. Поля рендерятся из схемы,
 * поэтому новая колонка в таблице появляется здесь без правки кода.
 */
export function BrandForm({ fields, rows, initial, submitLabel, busy, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<BrandRow>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const field of fields) {
      if (field.type === 'select' || field.type === 'multiselect') {
        map.set(field.column, collectOptions(field, rows))
      }
    }
    return map
  }, [fields, rows])

  const set = (column: string, value: string) =>
    setValues((prev) => ({ ...prev, [column]: value }))

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const result = validate(fields, values)
    setErrors(result.errors)
    if (!result.ok) {
      document.querySelector('.field--invalid')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    onSubmit(values)
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {fields.map((field) => (
        <div
          key={field.column}
          className={`field${errors[field.column] ? ' field--invalid' : ''}`}
        >
          <label htmlFor={`f-${field.column}`}>
            {field.label}
            {field.required && <span className="required" aria-hidden="true"> *</span>}
          </label>

          <Control
            field={field}
            value={values[field.column] ?? ''}
            options={optionsByColumn.get(field.column) ?? []}
            onChange={(v) => set(field.column, v)}
          />

          {errors[field.column] && <p className="field__error">{errors[field.column]}</p>}
        </div>
      ))}

      <div className="form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Сохраняем…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function Control({
  field,
  value,
  options,
  onChange,
}: {
  field: FieldDef
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  const id = `f-${field.column}`

  switch (field.type) {
    case 'longtext':
      return <textarea id={id} rows={4} value={value} onChange={(e) => onChange(e.target.value)} />

    case 'bool': {
      const [yes, no] = boolPair(field)
      return (
        <label className="checkbox">
          <input
            id={id}
            type="checkbox"
            checked={isTruthy(value)}
            onChange={(e) => onChange(e.target.checked ? yes : no)}
          />
          <span>Да</span>
        </label>
      )
    }

    case 'select':
      return <SingleSelect id={id} value={value} options={options} onChange={onChange} />

    case 'multiselect':
      return <MultiSelect id={id} value={value} options={options} onChange={onChange} />

    case 'number':
      return <input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />

    case 'date':
      return <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />

    case 'url':
      return (
        <input
          id={id}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    default:
      return <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
  }
}

/**
 * Справочник с одним значением: ряд кнопок вместо выпадашки — «ткнуть» быстрее,
 * чем вписывать. Устроен как MultiSelect ниже, разница только в том, что
 * выбранное значение одно.
 */
function SingleSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = useState('')
  // Значение из старой записи, которого нет в справочнике, всё равно показываем
  // кнопкой — иначе оно потерялось бы при первом же сохранении.
  const all = value && !options.includes(value) ? [...options, value] : options

  const add = () => {
    const v = draft.trim()
    if (v) onChange(v)
    setDraft('')
  }

  return (
    <div className="multiselect">
      <div className="chips">
        {all.map((option) => (
          <button
            key={option}
            type="button"
            className={`chip${value === option ? ' chip--on' : ''}`}
            // Повторный клик снимает выбор: необязательное поле нужно уметь очистить.
            onClick={() => onChange(value === option ? '' : option)}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="multiselect__add">
        <input
          id={id}
          value={draft}
          placeholder="Другое значение"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="btn btn--ghost" onClick={add}>
          Добавить
        </button>
      </div>
    </div>
  )
}

function MultiSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = useState('')
  const selected = splitMulti(value)

  const toggle = (option: string) => {
    const next = selected.includes(option)
      ? selected.filter((v) => v !== option)
      : [...selected, option]
    onChange(joinMulti(next))
  }

  const add = () => {
    const v = draft.trim()
    if (v && !selected.includes(v)) onChange(joinMulti([...selected, v]))
    setDraft('')
  }

  return (
    <div className="multiselect">
      <div className="chips">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`chip${selected.includes(option) ? ' chip--on' : ''}`}
            onClick={() => toggle(option)}
          >
            {option}
          </button>
        ))}
        {selected
          .filter((v) => !options.includes(v))
          .map((v) => (
            <button key={v} type="button" className="chip chip--on" onClick={() => toggle(v)}>
              {v}
            </button>
          ))}
      </div>
      <div className="multiselect__add">
        <input
          id={id}
          value={draft}
          placeholder="Добавить значение"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="btn btn--ghost" onClick={add}>
          Добавить
        </button>
      </div>
    </div>
  )
}
