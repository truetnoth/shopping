import { useState } from 'react'
import type { BrandRow, FieldDef } from '../api/types'
import { boolPair, isTruthy, joinMulti, optionsWithOwn, splitMulti, validate } from '../lib/schema'

interface Props {
  fields: FieldDef[]
  initial: BrandRow
  submitLabel: string
  busy?: boolean
  onSubmit: (values: BrandRow) => void
  onCancel: () => void
}

/**
 * Одна форма и для создания, и для редактирования. Поля рендерятся из схемы,
 * поэтому новая колонка в таблице появляется здесь без правки кода.
 *
 * Справочники закрыты: варианты берутся только из field_defs, завести новое
 * значение из формы нельзя — состав свойств задаёт база.
 */
export function BrandForm({ fields, initial, submitLabel, busy, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<BrandRow>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})

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
      {fields.map((field) => {
        const id = `f-${field.column}`
        // У списка кнопок нет одного «того самого» поля ввода, на которое мог бы
        // указывать label, поэтому заголовок такого поля — обычный заголовок
        // группы, а связь с кнопками держится на aria-labelledby.
        const chips = field.type === 'select' || field.type === 'multiselect'
        const options = chips ? optionsWithOwn(field, values[field.column] ?? '') : []
        const title = (
          <>
            {field.label}
            {field.required && <span className="required" aria-hidden="true"> *</span>}
          </>
        )

        return (
          <div
            key={field.column}
            className={`field${errors[field.column] ? ' field--invalid' : ''}`}
          >
            {chips ? (
              <span className="field__title" id={`${id}-title`}>{title}</span>
            ) : (
              <label htmlFor={id}>{title}</label>
            )}

            {chips && !options.length ? (
              <p className="field__hint">Варианты пока не заданы в базе</p>
            ) : (
              <Control
                id={id}
                field={field}
                value={values[field.column] ?? ''}
                options={options}
                onChange={(v) => set(field.column, v)}
              />
            )}

            {errors[field.column] && <p className="field__error">{errors[field.column]}</p>}
          </div>
        )
      })}

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
  id,
  field,
  value,
  options,
  onChange,
}: {
  id: string
  field: FieldDef
  value: string
  /** Уже посчитано выше: варианты из базы плюс своё значение строки. */
  options: string[]
  onChange: (value: string) => void
}) {
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

/** Справочник с одним значением: ряд кнопок, выбрана максимум одна. */
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
  return (
    <div className="chips" role="group" aria-labelledby={`${id}-title`}>
      {options.map((option) => (
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
  )
}

/** То же самое, но значений можно выбрать несколько. */
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
  const selected = splitMulti(value)

  const toggle = (option: string) => {
    const next = selected.includes(option)
      ? selected.filter((v) => v !== option)
      : [...selected, option]
    onChange(joinMulti(next))
  }

  return (
    <div className="chips" role="group" aria-labelledby={`${id}-title`}>
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
    </div>
  )
}
