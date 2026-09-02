interface Props {
  value: string
  onChange: (value: string) => void
  total: number
  found: number
}

export function SearchBar({ value, onChange, total, found }: Props) {
  return (
    <div className="searchbar">
      <input
        className="searchbar__input"
        type="search"
        value={value}
        placeholder="Поиск по бренду, категории, контактам…"
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <p className="searchbar__meta muted">
        {value.trim() ? `Найдено: ${found} из ${total}` : `Брендов в базе: ${total}`}
      </p>
    </div>
  )
}
