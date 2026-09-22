import { Link } from 'react-router-dom'
import type { Scope } from '../api/types'
import { CATEGORIES } from '../lib/categories'

/**
 * Первый фильтр: три крупные категории плюс «Все». Выбор живёт в адресе, а не
 * в состоянии, чтобы ссылку на нужный раздел можно было отправить коллеге.
 *
 * «Все» стоит последней намеренно: редакция работает по разделам, а общий
 * список нужен ей в основном как счётчик всей базы. Адрес у него прежний — «/».
 */
export function CategoryTabs({ scope, counts }: { scope: Scope; counts: Record<string, number> }) {
  const tabs: { id: Scope; label: string; to: string }[] = [
    ...CATEGORIES.map((c) => ({ id: c.id as Scope, label: c.label, to: `/c/${c.id}` })),
    { id: 'all', label: 'Все', to: '/' },
  ]

  return (
    <nav className="chips chips--tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.to}
          className={`chip${tab.id === scope ? ' chip--on' : ''}`}
        >
          {tab.label}
          <span className="chip__count"> {counts[tab.id] ?? 0}</span>
        </Link>
      ))}
    </nav>
  )
}
