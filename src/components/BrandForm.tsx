import { useState } from 'react'
import type { ReactNode } from 'react'
import type { BrandRow, FieldDef } from '../api/types'
import {
  boolPair, isOpen, isTruthy, joinMulti, normalizeOption, optionsWithOwn, splitMulti, validate,
} from '../lib/schema'

interface Props {
  fields: FieldDef[]
  initial: BrandRow
  /** Вся база: из неё растут варианты открытых справочников (город, страна). */
  rows: BrandRow[]
  submitLabel: string
  busy?: boolean
  /** Подсказка под названием: страница считает её по текущему вводу. */
  renderNameNote?: (value: string) => ReactNode
  onSubmit: (values: BrandRow) => void
  onCancel: () => void
}

/**
 * Одна форма и для создания, и для редактирования. Поля рендерятся из схемы,
 * поэтому новая колонка в таблице появляется здесь без правки кода.
 *
 * Справочники закрыты: варианты берутся только из field_defs, завести новое
 * значение из формы нельзя — состав свойств задаёт база. Исключение — поля
 * типов openselect и openmulti: туда своё значение вписывается прямо из формы.
 */
export function BrandForm({
  fields,
  initial,
  rows,
  submitLabel,
  busy,
  renderNameNote,
  onSubmit,
  onCancel,
}: Props) {
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

  // Идущие подряд галочки рисуются одной строкой таблеток: у каждой был свой
  // заголовок и своя строка с «Да» под ним — три строки экрана на свойство,
  // которое умещается в одну кнопку.
  const blocks: ({ kind: 'field'; field: FieldDef } | { kind: 'bools'; fields: FieldDef[] })[] = []
  for (const field of fields) {
    const last = blocks[blocks.length - 1]
    if (field.type !== 'bool') {
      blocks.push({ kind: 'field', field })
    } else if (last?.kind === 'bools') {
      last.fields.push(field)
    } else {
      blocks.push({ kind: 'bools', fields: [field] })
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {blocks.map((block) => {
        if (block.kind === 'bools') {
          const broken = block.fields.filter((f) => errors[f.column])
          return (
            <div
              key={`bools-${block.fields[0].column}`}
              className={`field field--bools${broken.length ? ' field--invalid' : ''}`}
            >
              <div className="chips">
                {block.fields.map((field) => (
                  <BoolChip
                    key={field.column}
                    field={field}
                    value={values[field.column] ?? ''}
                    onChange={(v) => set(field.column, v)}
                  />
                ))}
              </div>
              {broken.map((f) => (
                <p key={f.column} className="field__error">{f.label}: {errors[f.column]}</p>
              ))}
            </div>
          )
        }

        const { field } = block
        const id = `f-${field.column}`
        // У списка кнопок нет одного «того самого» поля ввода, на которое мог бы
        // указывать label, поэтому заголовок такого поля — обычный заголовок
        // группы, а связь с кнопками держится на aria-labelledby.
        const chips =
          field.type === 'select' ||
          field.type === 'multiselect' ||
          field.type === 'openselect' ||
          field.type === 'openmulti'
        const options = chips ? optionsWithOwn(field, values[field.column] ?? '', rows) : []
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

            {chips && !options.length && !isOpen(field) ? (
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

            {field.isName && renderNameNote?.(values[field.column] ?? '')}

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

    case 'select':
      return <SingleSelect id={id} value={value} options={options} onChange={onChange} />

    case 'openselect':
      return <OpenSelect id={id} value={value} options={options} onChange={onChange} />

    case 'multiselect':
      return <MultiSelect id={id} value={value} options={options} onChange={onChange} />

    case 'openmulti':
      return <OpenMultiSelect id={id} value={value} options={options} onChange={onChange} />

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
 * Галочка — такая же таблетка, как в фильтрах и справочниках: нажал, внутри
 * появилась галочка. Подпись стоит на самой кнопке, отдельного заголовка у
 * такого поля нет.
 */
function BoolChip({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string
  onChange: (value: string) => void
}) {
  const [yes, no] = boolPair(field)
  const on = isTruthy(value)

  return (
    <button
      type="button"
      className={`chip${on ? ' chip--on' : ''}`}
      aria-pressed={on}
      onClick={() => onChange(on ? no : yes)}
    >
      {on && <span className="chip__check" aria-hidden="true">✓ </span>}
      {field.label}
    </button>
  )
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

/**
 * Открытый справочник: те же кнопки плюс «+ Другой». Нового города в списке
 * может не быть — тогда его вписывают руками, и со следующей загрузки базы он
 * станет кнопкой у всей редакции (варианты считаются и по самим данным).
 */
function OpenSelect({
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
          onClick={() => onChange(value === option ? '' : option)}
        >
          {option}
        </button>
      ))}

      <AddOwn id={id} label="+ Другой" options={options} onAdd={onChange} />
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
  return (
    <div className="chips" role="group" aria-labelledby={`${id}-title`}>
      <MultiChips value={value} options={options} onChange={onChange} />
    </div>
  )
}

/**
 * Многозначный справочник, открытый на дописывание: так сделаны «Пометки» в
 * красоте. Отличие от города не только в количестве значений — вписанное сразу
 * становится выбранным, иначе «+ Добавить» пришлось бы подтверждать дважды.
 */
function OpenMultiSelect({
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
  const add = (option: string) => {
    const selected = splitMulti(value)
    if (!selected.includes(option)) onChange(joinMulti([...selected, option]))
  }

  return (
    <div className="chips" role="group" aria-labelledby={`${id}-title`}>
      <MultiChips value={value} options={options} onChange={onChange} />
      <AddOwn id={id} label="+ Добавить" options={options} onAdd={add} />
    </div>
  )
}

/** Кнопки многозначного справочника — общее у закрытого и открытого. */
function MultiChips({
  value,
  options,
  onChange,
}: {
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
    <>
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
    </>
  )
}

/**
 * Кнопка «вписать своё» и поле ввода на её месте — общее у обоих открытых
 * справочников. Введённое прогоняется через normalizeOption: если такое
 * значение уже есть с другим регистром, берётся известное написание.
 */
function AddOwn({
  id,
  label,
  options,
  onAdd,
}: {
  id: string
  label: string
  options: string[]
  onAdd: (value: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const add = () => {
    const next = normalizeOption(draft ?? '', options)
    // Пустой ввод — просто закрыть поле, а не стереть уже выбранное значение.
    if (next) onAdd(next)
    setDraft(null)
  }

  if (draft === null) {
    return (
      <button type="button" className="chip" onClick={() => setDraft('')}>
        {label}
      </button>
    )
  }

  return (
    <span className="chips__add">
      <input
        id={id}
        autoFocus
        value={draft}
        aria-label="Своё значение"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Enter внутри формы иначе отправил бы её целиком.
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
          if (e.key === 'Escape') setDraft(null)
        }}
      />
      <button type="button" className="btn btn--small" onClick={add}>
        Добавить
      </button>
    </span>
  )
}
